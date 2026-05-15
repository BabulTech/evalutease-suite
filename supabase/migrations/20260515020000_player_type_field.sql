-- ============================================================
-- Phase 2: expose `type` to the participant so the quiz player
-- can render the right UI per question. Also start writing
-- points_awarded on each auto-graded answer so the new scoring
-- column matches reality going forward.
-- ============================================================

-- Replace get_session_for_play with one that returns question.type
CREATE OR REPLACE FUNCTION public.get_session_for_play(
  p_access_code TEXT,
  p_attempt_id  UUID
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
  WHERE access_code = p_access_code AND mode = 'qr_link';
  IF v_session.id IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  SELECT * INTO v_attempt
  FROM quiz_attempts WHERE id = p_attempt_id AND session_id = v_session.id;
  IF v_attempt.id IS NULL THEN RETURN jsonb_build_object('error', 'attempt_not_found'); END IF;

  SELECT * INTO v_settings FROM host_settings WHERE owner_id = v_session.owner_id;

  SELECT count(*) INTO v_total
  FROM quiz_session_questions WHERE session_id = v_session.id;

  IF v_session.status IN ('active', 'completed') THEN
    SELECT jsonb_agg(jsonb_build_object(
      'id',           q.id,
      'text',         q.text,
      'type',         COALESCE(q.type::TEXT, 'mcq'),
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
      'total_questions',           v_total
    ),
    'registration_fields', COALESCE(v_settings.registration_fields, '{}'::jsonb),
    'questions', v_questions
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_session_for_play(TEXT, UUID) TO anon, authenticated;

-- Update submit_quiz_answer to also persist points_awarded for auto-graded types.
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
  v_question questions;
  v_is_correct BOOLEAN;
  v_points INT;
  v_max_points INT;
  v_settings host_settings;
  v_marks INT;
  v_acceptable_match BOOLEAN;
BEGIN
  SELECT * INTO v_attempt FROM quiz_attempts WHERE id = p_attempt_id;
  IF v_attempt.id IS NULL THEN RETURN jsonb_build_object('error', 'attempt_not_found'); END IF;

  SELECT * INTO v_session FROM quiz_sessions WHERE id = v_attempt.session_id;
  IF v_session.id IS NULL THEN RETURN jsonb_build_object('error', 'session_not_found'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM quiz_session_questions
    WHERE session_id = v_session.id AND question_id = p_question_id
  ) THEN
    RETURN jsonb_build_object('error', 'question_not_in_session');
  END IF;

  SELECT * INTO v_question FROM questions WHERE id = p_question_id;
  v_max_points := COALESCE(v_question.max_points, 1);

  -- Grading by type
  IF v_question.type IN ('mcq', 'true_false') THEN
    v_is_correct := (p_answer IS NOT NULL AND v_question.correct_answer IS NOT NULL
                     AND p_answer = v_question.correct_answer);
    v_points := CASE WHEN v_is_correct THEN v_max_points ELSE 0 END;
  ELSIF v_question.type = 'short_answer' AND NOT COALESCE(v_question.requires_manual_grading, FALSE)
        AND v_question.acceptable_answers IS NOT NULL THEN
    -- Case-insensitive trim match against any acceptable answer
    v_acceptable_match := EXISTS (
      SELECT 1 FROM unnest(v_question.acceptable_answers) ans
      WHERE lower(trim(ans)) = lower(trim(COALESCE(p_answer, '')))
    );
    v_is_correct := v_acceptable_match;
    v_points := CASE WHEN v_acceptable_match THEN v_max_points ELSE 0 END;
  ELSE
    -- Manual grading required (long_answer or short with requires_manual_grading)
    v_is_correct := NULL;
    v_points := NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM quiz_answers
    WHERE attempt_id = p_attempt_id AND question_id = p_question_id
  ) THEN
    RETURN jsonb_build_object('ok', TRUE, 'duplicate', TRUE);
  END IF;

  INSERT INTO quiz_answers (
    attempt_id, question_id, answer, is_correct, time_taken_seconds, points_awarded
  )
  VALUES (
    p_attempt_id, p_question_id, p_answer, v_is_correct, p_time_taken_seconds, v_points
  );

  -- Only auto-graded points feed the live score. Manual-grade answers update
  -- the score later when the host grades them.
  IF v_is_correct = TRUE THEN
    SELECT * INTO v_settings FROM host_settings WHERE owner_id = v_session.owner_id;
    v_marks := COALESCE(v_settings.marks_per_correct, 1) * v_max_points;
    UPDATE quiz_attempts SET score = score + v_marks WHERE id = p_attempt_id;
  END IF;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(UUID, UUID, TEXT, INT) TO anon, authenticated;
