-- Locked-down EXPLAIN helper for production hardening.
-- Use with a service-role client to inspect known hot-path plans without
-- exposing arbitrary SQL execution.

CREATE OR REPLACE FUNCTION public.explain_quiz_hot_path(
  p_plan TEXT,
  p_session_id UUID DEFAULT NULL,
  p_owner_id UUID DEFAULT NULL,
  p_access_code TEXT DEFAULT NULL
)
RETURNS TABLE(plan TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_plan = 'participant_join_session' THEN
    RETURN QUERY EXECUTE
      'EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
       SELECT id, owner_id, status, is_open
       FROM public.quiz_sessions
       WHERE access_code = $1 AND mode = ''qr_link'' AND is_open = TRUE'
    USING p_access_code;
    RETURN;
  END IF;

  IF p_plan = 'session_question_delivery' THEN
    RETURN QUERY EXECUTE
      'EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
       SELECT q.id, q.text, q.options, sq.position
       FROM public.quiz_session_questions sq
       JOIN public.questions q ON q.id = sq.question_id
       WHERE sq.session_id = $1
       ORDER BY sq.position ASC'
    USING p_session_id;
    RETURN;
  END IF;

  IF p_plan = 'live_leaderboard' THEN
    RETURN QUERY EXECUTE
      'EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
       SELECT a.id, a.participant_name, a.participant_email, a.participant_id,
              a.completed, a.completed_at, a.score, a.total_questions,
              p.metadata
       FROM public.quiz_attempts a
       LEFT JOIN public.participants p ON p.id = a.participant_id
       WHERE a.session_id = $1
       ORDER BY a.started_at ASC'
    USING p_session_id;
    RETURN;
  END IF;

  IF p_plan = 'completed_report_attempts' THEN
    RETURN QUERY EXECUTE
      'EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
       SELECT id, session_id, participant_name, participant_email, score,
              total_questions, completed, completed_at
       FROM public.quiz_attempts
       WHERE session_id = $1
       ORDER BY score DESC'
    USING p_session_id;
    RETURN;
  END IF;

  IF p_plan = 'owner_active_sessions' THEN
    RETURN QUERY EXECUTE
      'EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
       SELECT id, title, status, access_code, created_at
       FROM public.quiz_sessions
       WHERE owner_id = $1 AND status <> ''completed''
       ORDER BY created_at DESC
       LIMIT 50'
    USING p_owner_id;
    RETURN;
  END IF;

  IF p_plan = 'owner_completed_sessions' THEN
    RETURN QUERY EXECUTE
      'EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
       SELECT id, title, created_at, category_id, subcategory_id, subject, topic
       FROM public.quiz_sessions
       WHERE owner_id = $1 AND status = ''completed''
       ORDER BY created_at DESC'
    USING p_owner_id;
    RETURN;
  END IF;

  IF p_plan = 'participant_roster_email_lookup' THEN
    RETURN QUERY EXECUTE
      'EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
       SELECT p.id, p.name, p.email
       FROM public.participants p
       JOIN public.quiz_sessions s ON s.owner_id = p.owner_id
       WHERE s.id = $1
         AND lower(COALESCE(p.email, '''')) = lower(COALESCE($2, ''''))
       LIMIT 1'
    USING p_session_id, p_access_code;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Unknown plan %. Valid plans: participant_join_session, session_question_delivery, live_leaderboard, completed_report_attempts, owner_active_sessions, owner_completed_sessions, participant_roster_email_lookup', p_plan;
END;
$$;

REVOKE ALL ON FUNCTION public.explain_quiz_hot_path(TEXT, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.explain_quiz_hot_path(TEXT, UUID, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';

