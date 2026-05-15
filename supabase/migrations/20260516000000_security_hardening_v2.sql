-- ============================================================
-- SECURITY HARDENING v2 — Penetration Test Fixes
-- Run after all existing migrations.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- FIX 1: accept_company_invite — remove anon grant, enforce
--         caller identity so p_host_user_id must equal auth.uid()
-- ────────────────────────────────────────────────────────────
-- EXPLOIT: anon callers could pass any UUID as p_host_user_id,
-- stealing another user's invite slot and draining admin credits.

REVOKE EXECUTE ON FUNCTION public.accept_company_invite(UUID, TEXT, UUID) FROM anon;

CREATE OR REPLACE FUNCTION public.accept_company_invite(
  p_member_id    UUID,
  p_token        TEXT,
  p_host_user_id UUID
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member   public.company_members%ROWTYPE;
  v_admin_id UUID;
  v_amount   INT;
BEGIN
  -- SECURITY: caller must be the person accepting the invite.
  -- Prevents anon/third-party from hijacking invite slots.
  IF auth.uid() IS NULL OR auth.uid() <> p_host_user_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Prevent reuse: only pending members can be activated.
  SELECT * INTO v_member
  FROM public.company_members
  WHERE id = p_member_id
    AND invite_token::TEXT = p_token
    AND status = 'pending'
  LIMIT 1;
  IF v_member.id IS NULL THEN RETURN FALSE; END IF;

  -- Token expiry: reject tokens older than 30 days.
  IF v_member.created_at < now() - INTERVAL '30 days' THEN
    RETURN FALSE;
  END IF;

  UPDATE public.company_members
     SET user_id = p_host_user_id,
         status  = 'active',
         updated_at = now()
   WHERE id = p_member_id;

  SELECT admin_user_id INTO v_admin_id
    FROM public.company_profiles
   WHERE id = v_member.company_id
   LIMIT 1;
  v_amount := COALESCE(v_member.credit_limit, 0);

  IF v_admin_id IS NOT NULL AND v_amount > 0 THEN
    BEGIN
      PERFORM public.deduct_credits(
        v_admin_id, v_amount, 'admin_adjustment',
        'Initial credit allocation to ' || COALESCE(v_member.full_name, 'host')
      );
      PERFORM public.add_credits(
        p_host_user_id, v_amount, 'admin_adjustment',
        'Initial credits from organization',
        p_member_id, v_admin_id
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- credit failure doesn't block invite; admin can transfer manually
    END;
  END IF;

  RETURN TRUE;
END;
$$;

-- Only authenticated users (the invitee themselves) may call this.
GRANT EXECUTE ON FUNCTION public.accept_company_invite(UUID, TEXT, UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- FIX 2: transfer_credits_to_host — enforce caller = p_admin_id
-- ────────────────────────────────────────────────────────────
-- EXPLOIT: any authenticated user could pass an arbitrary p_admin_id
-- to drain ANY user's credit balance into their own account.

CREATE OR REPLACE FUNCTION public.transfer_credits_to_host(
  p_admin_id     UUID,
  p_host_user_id UUID,
  p_member_id    UUID,
  p_amount       INTEGER,
  p_note         TEXT DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_admin_of_company BOOLEAN;
BEGIN
  -- SECURITY: caller must be the admin whose credits are being deducted.
  IF auth.uid() IS NULL OR auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'unauthorized: caller must be the credit source';
  END IF;

  -- SECURITY: verify the member belongs to admin's company.
  SELECT EXISTS (
    SELECT 1 FROM public.company_members cm
    JOIN public.company_profiles cp ON cp.id = cm.company_id
    WHERE cm.id = p_member_id
      AND cp.admin_user_id = p_admin_id
  ) INTO v_is_admin_of_company;

  IF NOT v_is_admin_of_company THEN
    RAISE EXCEPTION 'unauthorized: member not in your organization';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  -- Deduct from admin (returns false if insufficient balance)
  IF NOT public.deduct_credits(
    p_admin_id, p_amount, 'admin_adjustment',
    COALESCE(p_note, 'Credit transfer to host')
  ) THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  -- Add to host
  PERFORM public.add_credits(
    p_host_user_id, p_amount, 'admin_adjustment',
    COALESCE(p_note, 'Credits allocated by org admin'),
    p_member_id, p_admin_id
  );

  UPDATE public.company_members
    SET credit_limit = credit_limit + p_amount, updated_at = now()
    WHERE id = p_member_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_credits_to_host(UUID, UUID, UUID, INTEGER, TEXT) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- FIX 3: participant_invites — restrict anon SELECT
-- ────────────────────────────────────────────────────────────
-- EXPLOIT: USING (TRUE) let any anon dump ALL invite tokens via
-- REST API, then redeem any token for any participant slot.

DROP POLICY IF EXISTS "Anon reads invite by token" ON public.participant_invites;

-- Only the owner can see their own invites; anon access removed.
DROP POLICY IF EXISTS "Owner reads own invites" ON public.participant_invites;
CREATE POLICY "Owner reads own invites" ON public.participant_invites
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- FIX 4: submit_quiz_answer — only allow 'active' sessions
-- ────────────────────────────────────────────────────────────
-- EXPLOIT: participants could join scheduled sessions, see all
-- questions, and submit correct answers before the quiz started.

CREATE OR REPLACE FUNCTION public.submit_quiz_answer(
  p_attempt_id          UUID,
  p_question_id         UUID,
  p_answer              TEXT,
  p_time_taken_seconds  INT
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_attempt   quiz_attempts;
  v_session   quiz_sessions;
  v_correct   TEXT;
  v_is_correct BOOLEAN;
  v_settings  host_settings;
  v_marks     INT;
  v_ip        TEXT;
BEGIN
  -- Input validation
  IF p_answer IS NOT NULL AND length(p_answer) > 2000 THEN
    RETURN jsonb_build_object('error', 'answer_too_long');
  END IF;
  IF p_time_taken_seconds IS NOT NULL AND p_time_taken_seconds < 0 THEN
    RETURN jsonb_build_object('error', 'invalid_time');
  END IF;

  -- Per-IP rate limit
  v_ip := coalesce(
    current_setting('request.headers', TRUE)::jsonb->>'x-forwarded-for',
    'unknown'
  );
  v_ip := split_part(v_ip, ',', 1);
  v_ip := trim(v_ip);

  IF NOT public._rl_check('answer', v_ip, 200, 60) THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  SELECT * INTO v_attempt FROM quiz_attempts WHERE id = p_attempt_id;
  IF v_attempt.id IS NULL THEN
    RETURN jsonb_build_object('error', 'attempt_not_found');
  END IF;
  IF v_attempt.completed THEN
    RETURN jsonb_build_object('error', 'attempt_already_completed');
  END IF;

  SELECT * INTO v_session FROM quiz_sessions WHERE id = v_attempt.session_id;
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('error', 'session_not_found');
  END IF;

  -- FIX: only 'active' status; 'scheduled' sessions cannot receive answers.
  IF v_session.status <> 'active' THEN
    RETURN jsonb_build_object('error', 'session_not_active');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM quiz_session_questions
    WHERE session_id = v_session.id AND question_id = p_question_id
  ) THEN
    RETURN jsonb_build_object('error', 'question_not_in_session');
  END IF;

  -- Idempotency
  SELECT correct_answer INTO v_correct FROM questions WHERE id = p_question_id;
  v_is_correct := (p_answer IS NOT NULL AND v_correct IS NOT NULL AND p_answer = v_correct);

  IF EXISTS (
    SELECT 1 FROM quiz_answers
    WHERE attempt_id = p_attempt_id AND question_id = p_question_id
  ) THEN
    RETURN jsonb_build_object('is_correct', v_is_correct, 'duplicate', TRUE);
  END IF;

  INSERT INTO quiz_answers (attempt_id, question_id, answer, is_correct, time_taken_seconds)
  VALUES (p_attempt_id, p_question_id, p_answer, v_is_correct,
          LEAST(COALESCE(p_time_taken_seconds, 0), 3600));

  IF v_is_correct THEN
    SELECT * INTO v_settings FROM host_settings WHERE owner_id = v_session.owner_id;
    v_marks := COALESCE(v_settings.marks_per_correct, 1);
    UPDATE quiz_attempts SET score = score + v_marks WHERE id = p_attempt_id;
  END IF;

  RETURN jsonb_build_object('is_correct', v_is_correct, 'duplicate', FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(UUID, UUID, TEXT, INT) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- FIX 5: Rate limiting on participant invite RPCs
-- ────────────────────────────────────────────────────────────
-- EXPLOIT: get_invite_for_token and redeem_participant_invite
-- had zero rate limiting, enabling automated redemption/enumeration.

CREATE OR REPLACE FUNCTION public.get_invite_for_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite participant_invites;
  v_sub    participant_subtypes;
  v_type   participant_types;
  v_ip     TEXT;
BEGIN
  -- Input sanitisation
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;
  IF length(p_token) > 128 THEN
    RETURN jsonb_build_object('error', 'invalid_token');
  END IF;

  -- Rate limit: 15 token lookups per IP per minute
  v_ip := coalesce(
    current_setting('request.headers', TRUE)::jsonb->>'x-forwarded-for',
    current_setting('request.headers', TRUE)::jsonb->>'x-real-ip',
    'unknown'
  );
  v_ip := split_part(v_ip, ',', 1);
  v_ip := trim(v_ip);

  IF NOT public._rl_check('invite_lookup', v_ip, 15, 60) THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  SELECT * INTO v_invite FROM participant_invites WHERE token = p_token;
  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT * INTO v_sub FROM participant_subtypes WHERE id = v_invite.subtype_id;
  IF v_sub.id IS NULL THEN
    RETURN jsonb_build_object('error', 'subtype_missing');
  END IF;

  SELECT * INTO v_type FROM participant_types WHERE id = v_sub.type_id;

  RETURN jsonb_build_object(
    'invite', jsonb_build_object(
      'id',     v_invite.id,
      'status', v_invite.status,
      'email',  v_invite.email
    ),
    'type',    jsonb_build_object('id', v_type.id, 'name', v_type.name, 'icon', v_type.icon),
    'subtype', jsonb_build_object('id', v_sub.id,  'name', v_sub.name)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_for_token(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.redeem_participant_invite(
  p_token    TEXT,
  p_name     TEXT,
  p_email    TEXT    DEFAULT NULL,
  p_mobile   TEXT    DEFAULT NULL,
  p_metadata JSONB   DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite         participant_invites;
  v_participant_id UUID;
  v_ip             TEXT;
BEGIN
  -- Input sanitisation
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN jsonb_build_object('error', 'name_required');
  END IF;
  IF length(trim(p_name)) > 120 THEN
    RETURN jsonb_build_object('error', 'name_too_long');
  END IF;

  -- Rate limit: 5 redemptions per IP per minute
  v_ip := coalesce(
    current_setting('request.headers', TRUE)::jsonb->>'x-forwarded-for',
    current_setting('request.headers', TRUE)::jsonb->>'x-real-ip',
    'unknown'
  );
  v_ip := split_part(v_ip, ',', 1);
  v_ip := trim(v_ip);

  IF NOT public._rl_check('invite_redeem', v_ip, 5, 60) THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  SELECT * INTO v_invite FROM participant_invites WHERE token = p_token;
  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_invite.status = 'accepted' THEN
    RETURN jsonb_build_object('error', 'already_redeemed');
  END IF;

  INSERT INTO participants (owner_id, name, email, mobile, metadata, subtype_id)
  VALUES (
    v_invite.owner_id,
    trim(p_name),
    NULLIF(trim(COALESCE(p_email, '')), ''),
    NULLIF(trim(COALESCE(p_mobile, '')), ''),
    COALESCE(p_metadata, '{}'::jsonb),
    v_invite.subtype_id
  )
  RETURNING id INTO v_participant_id;

  UPDATE participant_invites
  SET status = 'accepted',
      accepted_at = now(),
      accepted_participant_id = v_participant_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('participant_id', v_participant_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_participant_invite(TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- FIX 6: join_quiz_session — require strong identifier for roster
-- ────────────────────────────────────────────────────────────
-- EXPLOIT: if no email/mobile/roll_number given, name-only match
-- allowed any attacker to impersonate a rostered participant by
-- knowing only their full name.

CREATE OR REPLACE FUNCTION public.join_quiz_session(
  p_access_code TEXT,
  p_name        TEXT,
  p_email       TEXT DEFAULT NULL,
  p_mobile      TEXT DEFAULT NULL,
  p_roll_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session        quiz_sessions;
  v_total          INT;
  v_attempt_id     UUID;
  v_participant_id UUID;
  v_has_roster     BOOLEAN;
  v_ip             TEXT;
  v_name           TEXT;
  v_email          TEXT;
  v_mobile         TEXT;
  v_roll           TEXT;
BEGIN
  -- Input sanitisation
  v_name   := trim(coalesce(p_name, ''));
  v_email  := lower(trim(coalesce(p_email, '')));
  v_mobile := trim(coalesce(p_mobile, ''));
  v_roll   := trim(coalesce(p_roll_number, ''));

  IF length(v_name) = 0 THEN
    RETURN jsonb_build_object('error', 'name_required');
  END IF;
  IF length(v_name) > 120 THEN
    RETURN jsonb_build_object('error', 'name_too_long');
  END IF;
  IF length(v_email) > 254 THEN
    RETURN jsonb_build_object('error', 'email_too_long');
  END IF;
  IF length(v_email) > 0 AND v_email NOT LIKE '%@%.%' THEN
    RETURN jsonb_build_object('error', 'email_invalid');
  END IF;
  IF length(v_mobile) > 20 THEN
    RETURN jsonb_build_object('error', 'mobile_too_long');
  END IF;
  IF length(v_roll) > 50 THEN
    RETURN jsonb_build_object('error', 'roll_number_too_long');
  END IF;

  -- Per-IP rate limit: 10 joins / minute
  v_ip := coalesce(
    current_setting('request.headers', TRUE)::jsonb->>'x-forwarded-for',
    current_setting('request.headers', TRUE)::jsonb->>'x-real-ip',
    'unknown'
  );
  v_ip := split_part(v_ip, ',', 1);
  v_ip := trim(v_ip);

  IF NOT public._rl_check('join', v_ip, 10, 60) THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  -- Session lookup
  SELECT * INTO v_session
  FROM quiz_sessions
  WHERE access_code = upper(trim(p_access_code))
    AND mode = 'qr_link'
    AND is_open = TRUE;

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_session.status NOT IN ('scheduled', 'active') THEN
    RETURN jsonb_build_object('error', 'session_closed');
  END IF;

  -- Roster check
  SELECT EXISTS (
    SELECT 1 FROM quiz_session_participants WHERE session_id = v_session.id
  ) INTO v_has_roster;

  IF v_has_roster THEN
    -- FIX: require at least one strong identifier for roster sessions.
    -- Name-only match is removed — too easy to impersonate.
    IF length(v_email) = 0 AND length(v_mobile) = 0 AND length(v_roll) = 0 THEN
      RETURN jsonb_build_object('error', 'identifier_required');
    END IF;

    SELECT p.id INTO v_participant_id
    FROM participants p
    JOIN quiz_session_participants sp ON sp.participant_id = p.id
    WHERE sp.session_id = v_session.id
      AND (
        (length(v_email)  > 0 AND lower(p.email)              = v_email)
        OR (length(v_mobile) > 0 AND p.mobile                 = v_mobile)
        OR (length(v_roll)   > 0 AND p.metadata->>'roll_number' = v_roll)
      )
    LIMIT 1;

    IF v_participant_id IS NULL THEN
      RETURN jsonb_build_object('error', 'not_invited');
    END IF;
  END IF;

  -- Create attempt
  SELECT count(*) INTO v_total
  FROM quiz_session_questions
  WHERE session_id = v_session.id;

  INSERT INTO quiz_attempts (
    session_id, participant_id, participant_name, participant_email, total_questions
  ) VALUES (
    v_session.id,
    v_participant_id,
    v_name,
    CASE WHEN length(v_email) > 0 THEN v_email ELSE NULL END,
    COALESCE(v_total, 0)
  ) RETURNING id INTO v_attempt_id;

  RETURN jsonb_build_object('attempt_id', v_attempt_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_quiz_session(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- FIX 7: approve_credit_request — guard against insufficient funds
-- ────────────────────────────────────────────────────────────
-- BUG: deduct_credits returns FALSE on insufficient balance but
-- the approve function ignored the return value — it still marked
-- the request approved even if the admin had 0 credits.

CREATE OR REPLACE FUNCTION public.approve_credit_request(p_request_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req    public.credit_requests%ROWTYPE;
  v_admin  UUID;
  v_ok     BOOLEAN;
BEGIN
  SELECT * INTO v_req FROM public.credit_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req.id IS NULL OR v_req.status <> 'pending' THEN RETURN FALSE; END IF;

  SELECT admin_user_id INTO v_admin
    FROM public.company_profiles WHERE id = v_req.company_id LIMIT 1;
  IF v_admin IS NULL OR v_admin <> auth.uid() THEN RETURN FALSE; END IF;

  -- FIX: check return value — if FALSE, admin has insufficient credits.
  SELECT public.deduct_credits(
    v_admin, v_req.amount, 'admin_adjustment',
    COALESCE('Approved credit request: ' || v_req.note, 'Approved credit request')
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  PERFORM public.add_credits(
    v_req.requester_user_id, v_req.amount, 'admin_adjustment',
    COALESCE('Credit request approved: ' || v_req.note, 'Credit request approved'),
    v_req.member_id, v_admin
  );

  UPDATE public.credit_requests
     SET status = 'approved',
         resolved_by = v_admin,
         resolved_at = now(),
         updated_at = now()
   WHERE id = p_request_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_credit_request(UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- FIX 8: Invite token expiry column + index for company members
-- ────────────────────────────────────────────────────────────
-- Invite tokens had no expiry — a leaked token (email interception)
-- was valid forever. Now tokens expire after 30 days (enforced in
-- accept_company_invite above) and in preview function below.

ALTER TABLE public.company_members
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ
    DEFAULT (now() + INTERVAL '30 days');

-- Backfill existing pending invites
UPDATE public.company_members
   SET invite_expires_at = created_at + INTERVAL '30 days'
 WHERE invite_expires_at IS NULL AND status = 'pending';

CREATE INDEX IF NOT EXISTS idx_company_members_token_expiry
  ON public.company_members (invite_token, invite_expires_at)
  WHERE status = 'pending';

-- ────────────────────────────────────────────────────────────
-- FIX 9: preview_company_invite — rate limit + expiry check
-- ────────────────────────────────────────────────────────────

-- Drop and recreate — return type stays TABLE() to match accept-invite.tsx.
-- Changes: rate limiting + token expiry check added; VOLATILE for _rl_check.
DROP FUNCTION IF EXISTS public.preview_company_invite(UUID, TEXT);

CREATE FUNCTION public.preview_company_invite(
  p_member_id UUID,
  p_token     TEXT
) RETURNS TABLE(
  company_name  TEXT,
  invited_email TEXT,
  is_pending    BOOLEAN
) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member public.company_members%ROWTYPE;
  v_ip     TEXT;
BEGIN
  -- Rate limit: 10 previews per IP per minute
  v_ip := coalesce(
    current_setting('request.headers', TRUE)::jsonb->>'x-forwarded-for',
    current_setting('request.headers', TRUE)::jsonb->>'x-real-ip',
    'unknown'
  );
  v_ip := split_part(v_ip, ',', 1);
  v_ip := trim(v_ip);

  IF NOT public._rl_check('invite_preview', v_ip, 10, 60) THEN
    RETURN; -- empty result; caller sees no rows
  END IF;

  SELECT * INTO v_member
  FROM public.company_members
  WHERE id = p_member_id
    AND invite_token::TEXT = p_token
  LIMIT 1;

  IF v_member.id IS NULL THEN RETURN; END IF;

  -- Token expiry: reject tokens older than 30 days
  IF v_member.created_at < now() - INTERVAL '30 days' THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    cp.company_name,
    cm.invited_email,
    (cm.status <> 'active' OR cm.user_id IS NULL) AS is_pending
  FROM public.company_members cm
  JOIN public.company_profiles cp ON cp.id = cm.company_id
  WHERE cm.id = p_member_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_company_invite(UUID, TEXT) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- FIX 10: Spam protection on credit_requests
-- ────────────────────────────────────────────────────────────
-- A host could spam the admin with repeated requests even after decline.
-- Enforce: only 1 pending request per member at a time.

-- Partial unique index replaces EXCLUDE: no btree_gist extension required.
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_request_per_member
  ON public.credit_requests (member_id)
  WHERE status = 'pending';

-- ────────────────────────────────────────────────────────────
-- CLEANUP: revoke any implicit grants on sensitive functions
-- deduct_credits and add_credits are intentionally callable by authenticated
-- users (they have internal auth.uid() checks so users can only act on
-- their own balance).  Only anon gets revoked.
-- cleanup_rate_limit_ledger is a maintenance fn, no user should call it.
-- ────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER, public.credit_tx_type, TEXT, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_credits(UUID, INTEGER, public.credit_tx_type, TEXT, UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limit_ledger() FROM anon, authenticated;
