-- Prevent finalize_session_grading from running on sessions that haven't been
-- closed yet (status != 'grading'). Previously it would set an 'active' session
-- to 'completed' if all typed answers happened to be graded, bypassing the host's
-- explicit Close Session action.

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

  -- Only finalize if the session is already in 'grading' status.
  -- Calling this on an 'active' session would skip the proper close_quiz_session flow.
  IF v_session.status <> 'grading' THEN
    RETURN jsonb_build_object('error', 'session_not_in_grading_status');
  END IF;

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
