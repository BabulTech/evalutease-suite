-- Add has_pending_grading to complete_quiz_attempt response.
-- This lets the participant completion screen show "pending grading"
-- instead of a 0 score when long/short answer questions haven't been graded yet.

CREATE OR REPLACE FUNCTION public.complete_quiz_attempt(p_attempt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_attempt    quiz_attempts;
  v_session    quiz_sessions;
  v_settings   host_settings;
  v_speed_bonus INT := 0;
  v_avg        NUMERIC;
  v_final      INT;
  v_ip         TEXT;
  v_pending    BOOLEAN := FALSE;
BEGIN
  v_ip := coalesce(
    current_setting('request.headers', TRUE)::jsonb->>'x-forwarded-for',
    'unknown'
  );
  v_ip := split_part(v_ip, ',', 1);
  v_ip := trim(v_ip);

  IF NOT public._rl_check('complete', v_ip, 30, 60) THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  SELECT * INTO v_attempt FROM quiz_attempts WHERE id = p_attempt_id;
  IF v_attempt.id IS NULL THEN
    RETURN jsonb_build_object('error', 'attempt_not_found');
  END IF;

  IF v_attempt.completed THEN
    SELECT * INTO v_session FROM quiz_sessions WHERE id = v_attempt.session_id;
    SELECT EXISTS (
      SELECT 1 FROM quiz_answers qa
      JOIN questions q ON q.id = qa.question_id
      WHERE qa.attempt_id = p_attempt_id
        AND q.type IN ('short_answer', 'long_answer')
        AND qa.graded_at IS NULL
        AND qa.answer IS NOT NULL
    ) INTO v_pending;
    RETURN jsonb_build_object(
      'score', v_attempt.score,
      'total', v_attempt.total_questions,
      'speed_bonus', 0,
      'already_completed', TRUE,
      'has_pending_grading', v_pending,
      'show_results_after_quiz', COALESCE(v_session.show_results_after_quiz, TRUE)
    );
  END IF;

  SELECT * INTO v_session FROM quiz_sessions WHERE id = v_attempt.session_id;
  SELECT * INTO v_settings FROM host_settings WHERE owner_id = v_session.owner_id;

  IF COALESCE(v_settings.speed_bonus_enabled, FALSE)
     AND COALESCE(v_settings.speed_bonus_max, 0) > 0
     AND COALESCE(v_session.default_time_per_question, 0) > 0
  THEN
    SELECT AVG(time_taken_seconds)::NUMERIC INTO v_avg
    FROM quiz_answers
    WHERE attempt_id = p_attempt_id AND is_correct = TRUE;

    IF v_avg IS NOT NULL THEN
      v_speed_bonus := GREATEST(0, FLOOR(
        v_settings.speed_bonus_max * (1 - v_avg / v_session.default_time_per_question)
      ))::INT;
    END IF;
  END IF;

  -- Check if this attempt has any ungraded typed answers
  SELECT EXISTS (
    SELECT 1 FROM quiz_answers qa
    JOIN questions q ON q.id = qa.question_id
    WHERE qa.attempt_id = p_attempt_id
      AND q.type IN ('short_answer', 'long_answer')
      AND qa.graded_at IS NULL
      AND qa.answer IS NOT NULL
  ) INTO v_pending;

  UPDATE quiz_attempts
  SET completed = TRUE,
      completed_at = now(),
      score = score + v_speed_bonus
  WHERE id = p_attempt_id
  RETURNING score INTO v_final;

  RETURN jsonb_build_object(
    'score', v_final,
    'total', v_attempt.total_questions,
    'speed_bonus', v_speed_bonus,
    'already_completed', FALSE,
    'has_pending_grading', v_pending,
    'show_results_after_quiz', COALESCE(v_session.show_results_after_quiz, TRUE)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_quiz_attempt(UUID) TO anon, authenticated;
