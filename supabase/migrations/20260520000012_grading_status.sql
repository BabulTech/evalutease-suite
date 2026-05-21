-- Add 'grading' status to quiz_sessions.
-- When a session is closed but has ungraded short/long answers,
-- it moves to 'grading' instead of 'completed'. Once all answers
-- are graded, a trigger moves it to 'completed'.

-- 1. Add 'grading' to the session_status enum
ALTER TYPE public.session_status ADD VALUE IF NOT EXISTS 'grading';

-- 2. Update close_quiz_session: go to 'grading' if ungraded typed answers exist
CREATE OR REPLACE FUNCTION public.close_quiz_session(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session quiz_sessions;
  v_pending BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_session FROM quiz_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF v_session.owner_id <> auth.uid() THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;
  IF v_session.status IN ('completed', 'grading') THEN RETURN jsonb_build_object('error', 'already_closed'); END IF;

  -- Check for ungraded typed answers across all completed attempts
  SELECT EXISTS (
    SELECT 1
    FROM quiz_answers qa
    JOIN quiz_attempts att ON att.id = qa.attempt_id
    JOIN questions q ON q.id = qa.question_id
    WHERE att.session_id = p_session_id
      AND att.completed = TRUE
      AND q.type IN ('short_answer', 'long_answer')
      AND qa.graded_at IS NULL
      AND qa.answer IS NOT NULL
  ) INTO v_pending;

  UPDATE quiz_sessions
    SET status    = CASE WHEN v_pending THEN 'grading'::session_status ELSE 'completed'::session_status END,
        is_open   = FALSE,
        paused_at = NULL
  WHERE id = p_session_id;

  RETURN jsonb_build_object('ok', TRUE, 'needs_grading', v_pending);
END;
$$;
GRANT EXECUTE ON FUNCTION public.close_quiz_session(UUID) TO authenticated;

-- 3. Function to auto-complete a session once all answers are graded
CREATE OR REPLACE FUNCTION public.finalize_session_grading(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session quiz_sessions;
  v_still_pending BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_session FROM quiz_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF v_session.owner_id <> auth.uid() THEN RETURN jsonb_build_object('error', 'forbidden'); END IF;

  SELECT EXISTS (
    SELECT 1
    FROM quiz_answers qa
    JOIN quiz_attempts att ON att.id = qa.attempt_id
    JOIN questions q ON q.id = qa.question_id
    WHERE att.session_id = p_session_id
      AND att.completed = TRUE
      AND q.type IN ('short_answer', 'long_answer')
      AND qa.graded_at IS NULL
      AND qa.answer IS NOT NULL
  ) INTO v_still_pending;

  IF NOT v_still_pending THEN
    UPDATE quiz_sessions SET status = 'completed'::session_status WHERE id = p_session_id;
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'still_pending', v_still_pending);
END;
$$;
GRANT EXECUTE ON FUNCTION public.finalize_session_grading(UUID) TO authenticated;
