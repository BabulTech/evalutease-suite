-- Canonical participant identity for quiz attempts + reusable common invite links.

CREATE OR REPLACE FUNCTION public.ensure_quiz_attempts_subtype(p_owner_id UUID)
RETURNS UUID
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_type_id UUID;
  v_sub_id UUID;
BEGIN
  SELECT id INTO v_type_id
  FROM participant_types
  WHERE owner_id = p_owner_id AND name = 'Quiz Attempts'
  LIMIT 1;

  IF v_type_id IS NULL THEN
    INSERT INTO participant_types (owner_id, name, icon)
    VALUES (p_owner_id, 'Quiz Attempts', 'users')
    RETURNING id INTO v_type_id;
  END IF;

  SELECT id INTO v_sub_id
  FROM participant_subtypes
  WHERE owner_id = p_owner_id AND type_id = v_type_id AND name = 'All quiz participants'
  LIMIT 1;

  IF v_sub_id IS NULL THEN
    INSERT INTO participant_subtypes (owner_id, type_id, name, description)
    VALUES (
      p_owner_id,
      v_type_id,
      'All quiz participants',
      'Auto-saved students who joined or attempted a quiz.'
    )
    RETURNING id INTO v_sub_id;
  END IF;

  RETURN v_sub_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_quiz_attempts_subtype(UUID) TO anon, authenticated;

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
  v_participant participants;
  v_participant_id UUID;
  v_has_roster BOOLEAN;
  v_default_subtype_id UUID;
  v_email TEXT := lower(NULLIF(trim(COALESCE(p_email, '')), ''));
  v_meta JSONB := '{}'::jsonb;
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN jsonb_build_object('error', 'name_required');
  END IF;

  SELECT * INTO v_session
  FROM quiz_sessions
  WHERE access_code = p_access_code
    AND mode = 'qr_link'
    AND is_open = TRUE;

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
    IF v_email IS NULL THEN
      RETURN jsonb_build_object('error', 'email_required');
    END IF;

    SELECT p.* INTO v_participant
    FROM participants p
    JOIN quiz_session_participants sp ON sp.participant_id = p.id
    WHERE sp.session_id = v_session.id
      AND lower(COALESCE(p.email, '')) = v_email
    LIMIT 1;

    IF v_participant.id IS NULL THEN
      RETURN jsonb_build_object('error', 'not_invited');
    END IF;
  ELSIF v_email IS NOT NULL THEN
    SELECT * INTO v_participant
    FROM participants
    WHERE owner_id = v_session.owner_id
      AND lower(COALESCE(email, '')) = v_email
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_participant.id IS NULL THEN
      v_default_subtype_id := public.ensure_quiz_attempts_subtype(v_session.owner_id);
      IF p_roll_number IS NOT NULL AND length(trim(p_roll_number)) > 0 THEN
        v_meta := jsonb_build_object('roll_number', trim(p_roll_number));
      END IF;
      INSERT INTO participants (owner_id, name, email, mobile, metadata, subtype_id)
      VALUES (
        v_session.owner_id,
        trim(p_name),
        v_email,
        NULLIF(trim(COALESCE(p_mobile, '')), ''),
        v_meta,
        v_default_subtype_id
      )
      RETURNING * INTO v_participant;
    END IF;
  END IF;

  SELECT count(*) INTO v_total
  FROM quiz_session_questions
  WHERE session_id = v_session.id;

  v_participant_id := v_participant.id;

  INSERT INTO quiz_attempts (
    session_id,
    participant_id,
    participant_name,
    participant_email,
    total_questions
  ) VALUES (
    v_session.id,
    v_participant_id,
    COALESCE(v_participant.name, trim(p_name)),
    COALESCE(v_participant.email, v_email),
    COALESCE(v_total, 0)
  ) RETURNING id INTO v_attempt_id;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt_id,
    'participant_locked', v_participant_id IS NOT NULL,
    'participant_name', COALESCE(v_participant.name, trim(p_name)),
    'participant_email', COALESCE(v_participant.email, v_email)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_quiz_session(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

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
  v_participant participants;
  v_participant_id UUID;
  v_email TEXT := lower(NULLIF(trim(COALESCE(p_email, '')), ''));
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN jsonb_build_object('error', 'name_required');
  END IF;

  SELECT * INTO v_invite FROM participant_invites WHERE token = p_token;
  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  -- Email-specific invites stay one-time. Common links have invite.email NULL
  -- and remain reusable so many students can fill the same URL.
  IF v_invite.email IS NOT NULL AND v_invite.status = 'accepted' THEN
    RETURN jsonb_build_object('error', 'already_redeemed');
  END IF;

  IF v_invite.email IS NOT NULL THEN
    v_email := lower(v_invite.email);
  END IF;

  IF v_email IS NOT NULL THEN
    SELECT * INTO v_participant
    FROM participants
    WHERE owner_id = v_invite.owner_id
      AND lower(COALESCE(email, '')) = v_email
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_participant.id IS NULL THEN
    INSERT INTO participants (owner_id, name, email, mobile, metadata, subtype_id)
    VALUES (
      v_invite.owner_id,
      trim(p_name),
      v_email,
      NULLIF(trim(COALESCE(p_mobile, '')), ''),
      COALESCE(p_metadata, '{}'::jsonb),
      v_invite.subtype_id
    )
    RETURNING * INTO v_participant;
  ELSE
    -- Teacher-owned identity wins. Only place this known participant into the invited group.
    UPDATE participants
    SET subtype_id = v_invite.subtype_id
    WHERE id = v_participant.id
    RETURNING * INTO v_participant;
  END IF;

  v_participant_id := v_participant.id;

  UPDATE participant_invites
  SET status = CASE WHEN email IS NULL THEN status ELSE 'accepted' END,
      accepted_at = CASE WHEN email IS NULL THEN accepted_at ELSE now() END,
      accepted_participant_id = v_participant_id
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'participant_id', v_participant_id,
    'participant_locked', TRUE,
    'participant_name', v_participant.name,
    'participant_email', v_participant.email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_participant_invite(TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
