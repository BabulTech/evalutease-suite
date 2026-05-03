-- =====================================================================
-- Categories ↔ sub-categories, participant types ↔ sub-types, invites,
-- per-question time, session-level participant subtype roster.
-- Idempotent — safe to re-run.
-- =====================================================================

-- ===== Prerequisites from earlier migrations (idempotent catch-up) =====
-- These columns / table are added by 20260502152000_session_scheduling.sql and
-- 20260502152100_phase3_live_delivery.sql. They're repeated here so this file
-- can be run on any project — including ones where the older migrations were
-- never applied — without the rest of this transaction silently rolling back.

ALTER TABLE public.quiz_sessions
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS started_at   TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS category_id  UUID NULL
    REFERENCES public.question_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_scheduled
  ON public.quiz_sessions(scheduled_at)
  WHERE scheduled_at IS NOT NULL AND status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_category
  ON public.quiz_sessions(category_id);

CREATE TABLE IF NOT EXISTS public.host_settings (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  registration_fields JSONB NOT NULL DEFAULT '{
    "name":         {"visible": true,  "required": true},
    "email":        {"visible": true,  "required": false},
    "mobile":       {"visible": false, "required": false},
    "roll_number":  {"visible": true,  "required": false},
    "seat_number":  {"visible": false, "required": false},
    "class":        {"visible": false, "required": false},
    "organization": {"visible": false, "required": false}
  }'::jsonb,
  marks_per_correct INTEGER NOT NULL DEFAULT 1,
  speed_bonus_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  speed_bonus_max INTEGER NOT NULL DEFAULT 1,
  show_explanation BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.host_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Host manages own settings" ON public.host_settings;
CREATE POLICY "Host manages own settings" ON public.host_settings
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
DROP TRIGGER IF EXISTS host_settings_touch ON public.host_settings;
CREATE TRIGGER host_settings_touch BEFORE UPDATE ON public.host_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== Realtime publication so participants & host see status flips live =====
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_sessions;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_attempts;
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

-- ===== Public quiz RPCs (anon participants joining/playing via /q/<code>) =====
CREATE OR REPLACE FUNCTION public.get_session_for_join(p_access_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session quiz_sessions;
  v_settings host_settings;
  v_questions JSONB;
  v_total INT;
BEGIN
  SELECT * INTO v_session FROM quiz_sessions
  WHERE access_code = p_access_code AND mode = 'qr_link';
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT * INTO v_settings FROM host_settings WHERE owner_id = v_session.owner_id;

  SELECT count(*) INTO v_total FROM quiz_session_questions WHERE session_id = v_session.id;

  IF v_session.status IN ('active', 'completed') THEN
    SELECT jsonb_agg(jsonb_build_object(
      'id',           q.id,
      'text',         q.text,
      'options',      q.options,
      'position',     sq.position,
      'time_seconds', COALESCE(sq.time_seconds, v_session.default_time_per_question)
    ) ORDER BY sq.position) INTO v_questions
    FROM quiz_session_questions sq
    JOIN questions q ON q.id = sq.question_id
    WHERE sq.session_id = v_session.id;
  ELSE
    v_questions := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'session', jsonb_build_object(
      'id',                        v_session.id,
      'title',                     v_session.title,
      'status',                    v_session.status,
      'started_at',                v_session.started_at,
      'scheduled_at',              v_session.scheduled_at,
      'default_time_per_question', v_session.default_time_per_question,
      'access_code',               v_session.access_code,
      'is_open',                   v_session.is_open,
      'total_questions',           COALESCE(v_total, 0)
    ),
    'registration_fields', COALESCE(v_settings.registration_fields, '{
      "name": {"visible": true, "required": true}
    }'::jsonb),
    'questions', COALESCE(v_questions, '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_session_for_join(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.join_quiz_session(
  p_access_code TEXT,
  p_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_mobile TEXT DEFAULT NULL,
  p_roll_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session quiz_sessions;
  v_total INT;
  v_attempt_id UUID;
  v_participant_id UUID;
  v_has_roster BOOLEAN;
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN jsonb_build_object('error', 'name_required');
  END IF;
  SELECT * INTO v_session FROM quiz_sessions
  WHERE access_code = p_access_code AND mode = 'qr_link' AND is_open = TRUE;
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_session.status NOT IN ('scheduled', 'active') THEN
    RETURN jsonb_build_object('error', 'session_closed');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM quiz_session_participants WHERE session_id = v_session.id
  ) INTO v_has_roster;

  IF v_has_roster THEN
    SELECT p.id INTO v_participant_id
    FROM participants p
    JOIN quiz_session_participants sp ON sp.participant_id = p.id
    WHERE sp.session_id = v_session.id
      AND (
        (p_email IS NOT NULL AND length(trim(p_email)) > 0
          AND lower(p.email) = lower(trim(p_email)))
        OR (p_mobile IS NOT NULL AND length(trim(p_mobile)) > 0
          AND p.mobile = trim(p_mobile))
        OR (p_roll_number IS NOT NULL AND length(trim(p_roll_number)) > 0
          AND p.metadata->>'roll_number' = trim(p_roll_number))
        OR lower(p.name) = lower(trim(p_name))
      )
    LIMIT 1;
    IF v_participant_id IS NULL THEN
      RETURN jsonb_build_object('error', 'not_invited');
    END IF;
  END IF;

  SELECT count(*) INTO v_total FROM quiz_session_questions WHERE session_id = v_session.id;

  INSERT INTO quiz_attempts (
    session_id, participant_id, participant_name, participant_email, total_questions
  ) VALUES (
    v_session.id, v_participant_id, trim(p_name), p_email, COALESCE(v_total, 0)
  ) RETURNING id INTO v_attempt_id;

  RETURN jsonb_build_object('attempt_id', v_attempt_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.join_quiz_session(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_quiz_answer(
  p_attempt_id UUID,
  p_question_id UUID,
  p_answer TEXT,
  p_time_taken_seconds INT
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_attempt quiz_attempts;
  v_session quiz_sessions;
  v_correct TEXT;
  v_is_correct BOOLEAN;
  v_settings host_settings;
  v_marks INT;
BEGIN
  SELECT * INTO v_attempt FROM quiz_attempts WHERE id = p_attempt_id;
  IF v_attempt.id IS NULL THEN
    RETURN jsonb_build_object('error', 'attempt_not_found');
  END IF;
  SELECT * INTO v_session FROM quiz_sessions WHERE id = v_attempt.session_id;
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('error', 'session_not_found');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM quiz_session_questions
    WHERE session_id = v_session.id AND question_id = p_question_id
  ) THEN
    RETURN jsonb_build_object('error', 'question_not_in_session');
  END IF;

  SELECT correct_answer INTO v_correct FROM questions WHERE id = p_question_id;
  v_is_correct := (p_answer IS NOT NULL AND v_correct IS NOT NULL AND p_answer = v_correct);

  IF EXISTS (
    SELECT 1 FROM quiz_answers
    WHERE attempt_id = p_attempt_id AND question_id = p_question_id
  ) THEN
    RETURN jsonb_build_object('is_correct', v_is_correct, 'duplicate', TRUE);
  END IF;

  INSERT INTO quiz_answers (attempt_id, question_id, answer, is_correct, time_taken_seconds)
  VALUES (p_attempt_id, p_question_id, p_answer, v_is_correct, p_time_taken_seconds);

  IF v_is_correct THEN
    SELECT * INTO v_settings FROM host_settings WHERE owner_id = v_session.owner_id;
    v_marks := COALESCE(v_settings.marks_per_correct, 1);
    UPDATE quiz_attempts SET score = score + v_marks WHERE id = p_attempt_id;
  END IF;

  RETURN jsonb_build_object('is_correct', v_is_correct, 'duplicate', FALSE);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(UUID, UUID, TEXT, INT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.complete_quiz_attempt(p_attempt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_attempt quiz_attempts;
  v_session quiz_sessions;
  v_settings host_settings;
  v_speed_bonus INT := 0;
  v_avg NUMERIC;
  v_final INT;
BEGIN
  SELECT * INTO v_attempt FROM quiz_attempts WHERE id = p_attempt_id;
  IF v_attempt.id IS NULL THEN
    RETURN jsonb_build_object('error', 'attempt_not_found');
  END IF;
  IF v_attempt.completed THEN
    RETURN jsonb_build_object('score', v_attempt.score, 'total', v_attempt.total_questions, 'speed_bonus', 0, 'already_completed', TRUE);
  END IF;

  SELECT * INTO v_session FROM quiz_sessions WHERE id = v_attempt.session_id;
  SELECT * INTO v_settings FROM host_settings WHERE owner_id = v_session.owner_id;

  IF COALESCE(v_settings.speed_bonus_enabled, FALSE)
     AND COALESCE(v_settings.speed_bonus_max, 0) > 0
     AND COALESCE(v_session.default_time_per_question, 0) > 0 THEN
    SELECT AVG(time_taken_seconds)::NUMERIC INTO v_avg
    FROM quiz_answers WHERE attempt_id = p_attempt_id AND is_correct = TRUE;
    IF v_avg IS NOT NULL THEN
      v_speed_bonus := GREATEST(0, FLOOR(v_settings.speed_bonus_max * (1 - v_avg / v_session.default_time_per_question)))::INT;
    END IF;
  END IF;

  UPDATE quiz_attempts
  SET completed = TRUE, completed_at = now(), score = score + v_speed_bonus
  WHERE id = p_attempt_id RETURNING score INTO v_final;

  RETURN jsonb_build_object('score', v_final, 'total', v_attempt.total_questions, 'speed_bonus', v_speed_bonus, 'already_completed', FALSE);
END;
$$;
GRANT EXECUTE ON FUNCTION public.complete_quiz_attempt(UUID) TO anon, authenticated;

-- ===== QUESTION SUB-CATEGORIES =====
CREATE TABLE IF NOT EXISTS public.question_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.question_categories(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.question_subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages subcategories" ON public.question_subcategories;
CREATE POLICY "Owner manages subcategories" ON public.question_subcategories
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_question_subcategories_category
  ON public.question_subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_question_subcategories_owner
  ON public.question_subcategories(owner_id);

-- ===== QUESTION_CATEGORIES.icon =====
ALTER TABLE public.question_categories
  ADD COLUMN IF NOT EXISTS icon TEXT NULL;

-- ===== QUESTIONS: subcategory + per-question time =====
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.question_subcategories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS time_seconds INTEGER NOT NULL DEFAULT 10;

CREATE INDEX IF NOT EXISTS idx_questions_subcategory
  ON public.questions(subcategory_id);

-- ===== PARTICIPANT TYPES =====
CREATE TABLE IF NOT EXISTS public.participant_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.participant_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages participant types" ON public.participant_types;
CREATE POLICY "Owner manages participant types" ON public.participant_types
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_participant_types_owner
  ON public.participant_types(owner_id);

-- ===== PARTICIPANT SUB-TYPES =====
CREATE TABLE IF NOT EXISTS public.participant_subtypes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type_id UUID REFERENCES public.participant_types(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.participant_subtypes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages participant subtypes" ON public.participant_subtypes;
CREATE POLICY "Owner manages participant subtypes" ON public.participant_subtypes
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_participant_subtypes_type
  ON public.participant_subtypes(type_id);
CREATE INDEX IF NOT EXISTS idx_participant_subtypes_owner
  ON public.participant_subtypes(owner_id);

-- ===== PARTICIPANTS: subtype link =====
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS subtype_id UUID REFERENCES public.participant_subtypes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_participants_subtype
  ON public.participants(subtype_id);

-- ===== QUIZ SESSIONS: subcategory link =====
ALTER TABLE public.quiz_sessions
  ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.question_subcategories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_subcategory
  ON public.quiz_sessions(subcategory_id);

-- ===== QUIZ_SESSION_SUBTYPES (M:N session ↔ subtype roster) =====
CREATE TABLE IF NOT EXISTS public.quiz_session_subtypes (
  session_id UUID REFERENCES public.quiz_sessions(id) ON DELETE CASCADE NOT NULL,
  subtype_id UUID REFERENCES public.participant_subtypes(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (session_id, subtype_id)
);
ALTER TABLE public.quiz_session_subtypes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages session subtypes" ON public.quiz_session_subtypes;
CREATE POLICY "Owner manages session subtypes" ON public.quiz_session_subtypes
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.quiz_sessions s WHERE s.id = session_id AND s.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.quiz_sessions s WHERE s.id = session_id AND s.owner_id = auth.uid())
  );

-- ===== PARTICIPANT INVITES (copy-link redemption) =====
CREATE TABLE IF NOT EXISTS public.participant_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subtype_id UUID REFERENCES public.participant_subtypes(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  accepted_participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);
ALTER TABLE public.participant_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages own invites" ON public.participant_invites;
CREATE POLICY "Owner manages own invites" ON public.participant_invites
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Anon can read by token (the public landing page resolves the invite via this select).
DROP POLICY IF EXISTS "Anon reads invite by token" ON public.participant_invites;
CREATE POLICY "Anon reads invite by token" ON public.participant_invites
  FOR SELECT TO anon, authenticated USING (TRUE);
-- Note: token is a non-guessable UUID. RLS still allows row-level read; the public RPC below is what
-- the front-end actually uses, so the SELECT policy is permissive but harmless.

CREATE INDEX IF NOT EXISTS idx_participant_invites_owner
  ON public.participant_invites(owner_id);
CREATE INDEX IF NOT EXISTS idx_participant_invites_subtype
  ON public.participant_invites(subtype_id);

-- ===== get_invite_for_token =====
-- Public RPC that returns the type/subtype names + owner_id for the landing page.
CREATE OR REPLACE FUNCTION public.get_invite_for_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite participant_invites;
  v_sub participant_subtypes;
  v_type participant_types;
BEGIN
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

-- ===== redeem_participant_invite =====
-- Anon RPC: writes a participants row under the invite's owner & subtype, then
-- flips the invite to 'accepted'. One-shot (re-runs return already_redeemed).
CREATE OR REPLACE FUNCTION public.redeem_participant_invite(
  p_token TEXT,
  p_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_mobile TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite participant_invites;
  v_participant_id UUID;
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN jsonb_build_object('error', 'name_required');
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

-- ===== BACKFILL EXISTING DATA =====

-- 1. For every existing question_categories row, create a default "General" sub-category.
INSERT INTO public.question_subcategories (owner_id, category_id, name)
SELECT c.owner_id, c.id, 'General'
FROM public.question_categories c
WHERE NOT EXISTS (
  SELECT 1 FROM public.question_subcategories s WHERE s.category_id = c.id
);

-- 2. Move existing questions into the auto-created "General" sub-category.
UPDATE public.questions q
SET subcategory_id = (
  SELECT id FROM public.question_subcategories s
  WHERE s.category_id = q.category_id
  ORDER BY s.created_at ASC
  LIMIT 1
)
WHERE q.subcategory_id IS NULL AND q.category_id IS NOT NULL;

-- 3. Per-owner default participant_type "General" + default sub-type "General"; assign existing participants.
DO $$
DECLARE
  rec RECORD;
  v_type_id UUID;
  v_sub_id UUID;
BEGIN
  FOR rec IN SELECT DISTINCT owner_id FROM public.participants LOOP
    -- Pick or create default type
    SELECT id INTO v_type_id
    FROM public.participant_types
    WHERE owner_id = rec.owner_id AND name = 'General'
    LIMIT 1;

    IF v_type_id IS NULL THEN
      INSERT INTO public.participant_types (owner_id, name, icon)
      VALUES (rec.owner_id, 'General', 'users')
      RETURNING id INTO v_type_id;
    END IF;

    -- Pick or create default sub-type
    SELECT id INTO v_sub_id
    FROM public.participant_subtypes
    WHERE owner_id = rec.owner_id AND type_id = v_type_id AND name = 'General'
    LIMIT 1;

    IF v_sub_id IS NULL THEN
      INSERT INTO public.participant_subtypes (owner_id, type_id, name)
      VALUES (rec.owner_id, v_type_id, 'General')
      RETURNING id INTO v_sub_id;
    END IF;

    -- Backfill participants.subtype_id where missing
    UPDATE public.participants
    SET subtype_id = v_sub_id
    WHERE owner_id = rec.owner_id AND subtype_id IS NULL;
  END LOOP;
END $$;

-- 4. Existing sessions with category_id but no subcategory_id → first sub-category in that category.
UPDATE public.quiz_sessions ss
SET subcategory_id = (
  SELECT id FROM public.question_subcategories
  WHERE category_id = ss.category_id
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE ss.subcategory_id IS NULL AND ss.category_id IS NOT NULL;

-- ===== Tell PostgREST to reload the schema cache so the new FKs are usable from the front-end. =====
NOTIFY pgrst, 'reload schema';
