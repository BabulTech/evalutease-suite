-- Fix: private sessions (with subtypes attached) should block anyone not in the roster,
-- even if quiz_session_participants is empty.
-- Previously v_has_roster was only TRUE when participants existed — if subtypes were
-- attached but no participants matched, anyone could join.

CREATE OR REPLACE FUNCTION public.join_quiz_session(
  p_access_code   TEXT,
  p_name          TEXT,
  p_email         TEXT DEFAULT NULL,
  p_mobile        TEXT DEFAULT NULL,
  p_roll_number   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session        quiz_sessions%ROWTYPE;
  v_attempt_id     UUID;
  v_participant_id UUID;
  v_total          INT;
  v_has_roster     BOOLEAN;
  v_is_private     BOOLEAN;
  v_ip             TEXT;
  v_name           TEXT;
  v_email          TEXT;
  v_mobile         TEXT;
  v_roll           TEXT;
BEGIN
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

  -- Session is private if it has subtypes OR roster participants attached
  SELECT EXISTS (
    SELECT 1 FROM quiz_session_subtypes WHERE session_id = v_session.id
    UNION ALL
    SELECT 1 FROM quiz_session_participants WHERE session_id = v_session.id
  ) INTO v_is_private;

  -- Roster check: participants explicitly added to this session
  SELECT EXISTS (
    SELECT 1 FROM quiz_session_participants WHERE session_id = v_session.id
  ) INTO v_has_roster;

  IF v_is_private THEN
    -- Private session: require at least one identifier
    IF length(v_email) = 0 AND length(v_mobile) = 0 AND length(v_roll) = 0 THEN
      RETURN jsonb_build_object('error', 'identifier_required');
    END IF;

    IF v_has_roster THEN
      -- Match against roster
      SELECT p.id INTO v_participant_id
      FROM participants p
      JOIN quiz_session_participants sp ON sp.participant_id = p.id
      WHERE sp.session_id = v_session.id
        AND (
          (length(v_email)  > 0 AND lower(p.email)                = v_email)
          OR (length(v_mobile) > 0 AND p.mobile                   = v_mobile)
          OR (length(v_roll)   > 0 AND p.metadata->>'roll_number' = v_roll)
        )
      LIMIT 1;

      IF v_participant_id IS NULL THEN
        RETURN jsonb_build_object('error', 'not_invited');
      END IF;
    ELSE
      -- Has subtypes but no individual participants loaded yet — block everyone
      RETURN jsonb_build_object('error', 'not_invited');
    END IF;
  END IF;

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
