-- Fix submit_quiz_answer to score all question types correctly:
--   * mcq / true_false        → match against correct_answer, award q.max_points
--   * short_answer / long_answer → NO auto-grade. Always go through manual/AI grading.
-- Previously this RPC awarded a fixed marks_per_correct (1) and only handled MCQ,
-- so true_false partly worked but short/long always scored 0 and MCQ ignored max_points.

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
  v_attempt    quiz_attempts;
  v_session    quiz_sessions;
  v_question   questions;
  v_is_correct BOOLEAN := FALSE;
  v_points     INT := 0;
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

  SELECT * INTO v_question FROM questions WHERE id = p_question_id;

  IF EXISTS (
    SELECT 1 FROM quiz_answers
    WHERE attempt_id = p_attempt_id AND question_id = p_question_id
  ) THEN
    RETURN jsonb_build_object('ok', TRUE, 'duplicate', TRUE);
  END IF;

  -- Per-type grading
  IF p_answer IS NOT NULL AND length(trim(p_answer)) > 0 THEN
    IF v_question.type IN ('mcq', 'true_false') THEN
      v_is_correct := v_question.correct_answer IS NOT NULL
                  AND lower(trim(p_answer)) = lower(trim(v_question.correct_answer));
    ELSE
      -- short_answer / long_answer → leave is_correct NULL; graded later (manual/AI)
      v_is_correct := NULL;
    END IF;
  END IF;

  IF v_is_correct IS TRUE THEN
    v_points := COALESCE(v_question.max_points, 1);
  END IF;

  INSERT INTO quiz_answers (
    attempt_id, question_id, answer, is_correct, points_awarded, time_taken_seconds, graded_at
  ) VALUES (
    p_attempt_id,
    p_question_id,
    p_answer,
    v_is_correct,
    v_points,
    p_time_taken_seconds,
    CASE WHEN v_question.type IN ('mcq', 'true_false') THEN now() ELSE NULL END
  );

  IF v_points > 0 THEN
    UPDATE quiz_attempts SET score = score + v_points WHERE id = p_attempt_id;
  END IF;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(UUID, UUID, TEXT, INT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
