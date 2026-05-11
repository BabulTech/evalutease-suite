-- Participant bandwidth optimization:
-- 1. get_session_for_join returns only lobby/registration/session status data.
-- 2. get_session_for_play returns questions only after a valid attempt exists.
-- 3. join_quiz_session and submit_quiz_answer return minimal JSON responses.

CREATE OR REPLACE FUNCTION public.get_session_for_join(p_access_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session quiz_sessions;
  v_settings host_settings;
  v_total INT;
BEGIN
  SELECT * INTO v_session
  FROM quiz_sessions
  WHERE access_code = p_access_code
    AND mode = 'qr_link';

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT * INTO v_settings
  FROM host_settings
  WHERE owner_id = v_session.owner_id;

  SELECT count(*) INTO v_total
  FROM quiz_session_questions
  WHERE session_id = v_session.id;

  RETURN jsonb_build_object(
    'session', jsonb_build_object(
      'id',                        v_session.id,
      'title',                     v_session.title,
      'status',                    v_session.status,
      'started_at',                v_session.started_at,
      'scheduled_at',              v_session.scheduled_at,
      'paused_at',                 v_session.paused_at,
      'pause_offset_seconds',      COALESCE(v_session.pause_offset_seconds, 0),
      'default_time_per_question', v_session.default_time_per_question,
      'access_code',               v_session.access_code,
      'is_open',                   v_session.is_open,
      'total_questions',           COALESCE(v_total, 0)
    ),
    'registration_fields', COALESCE(v_settings.registration_fields, '{
      "name": {"visible": true, "required": true}
    }'::jsonb),
    'questions', '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_for_join(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_session_for_play(
  p_access_code TEXT,
  p_attempt_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session quiz_sessions;
  v_attempt quiz_attempts;
  v_settings host_settings;
  v_questions JSONB;
  v_total INT;
BEGIN
  SELECT * INTO v_session
  FROM quiz_sessions
  WHERE access_code = p_access_code
    AND mode = 'qr_link';

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT * INTO v_attempt
  FROM quiz_attempts
  WHERE id = p_attempt_id
    AND session_id = v_session.id;

  IF v_attempt.id IS NULL THEN
    RETURN jsonb_build_object('error', 'attempt_not_found');
  END IF;

  SELECT * INTO v_settings
  FROM host_settings
  WHERE owner_id = v_session.owner_id;

  SELECT count(*) INTO v_total
  FROM quiz_session_questions
  WHERE session_id = v_session.id;

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
      'paused_at',                 v_session.paused_at,
      'pause_offset_seconds',      COALESCE(v_session.pause_offset_seconds, 0),
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

GRANT EXECUTE ON FUNCTION public.get_session_for_play(TEXT, UUID) TO anon, authenticated;

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
    RETURN jsonb_build_object('ok', TRUE, 'duplicate', TRUE);
  END IF;

  INSERT INTO quiz_answers (attempt_id, question_id, answer, is_correct, time_taken_seconds)
  VALUES (p_attempt_id, p_question_id, p_answer, v_is_correct, p_time_taken_seconds);

  IF v_is_correct THEN
    SELECT * INTO v_settings FROM host_settings WHERE owner_id = v_session.owner_id;
    v_marks := COALESCE(v_settings.marks_per_correct, 1);
    UPDATE quiz_attempts SET score = score + v_marks WHERE id = p_attempt_id;
  END IF;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(UUID, UUID, TEXT, INT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_quiz_answers_batch(
  p_answers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_answer JSONB;
  v_count INT := 0;
BEGIN
  IF jsonb_typeof(p_answers) <> 'array' THEN
    RETURN jsonb_build_object('error', 'invalid_payload');
  END IF;

  FOR v_answer IN SELECT value FROM jsonb_array_elements(p_answers)
  LOOP
    PERFORM public.submit_quiz_answer(
      (v_answer->>'attempt_id')::UUID,
      (v_answer->>'question_id')::UUID,
      NULLIF(v_answer->>'answer', ''),
      COALESCE((v_answer->>'time_taken_seconds')::INT, 0)
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', TRUE, 'submitted', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_quiz_answers_batch(JSONB) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
