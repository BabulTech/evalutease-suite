-- ============================================================
-- Fix: "column reference 'id' is ambiguous" when loading the
-- session activity panel.
--
-- Cause: get_session_activity uses RETURNS TABLE(id UUID, ...),
-- which exposes a column named `id` in the function's scope.
-- The body then ran `SELECT 1 FROM quiz_sessions WHERE id = …`
-- without qualifying `id`, so Postgres couldn't tell whether it
-- meant quiz_sessions.id or the output column id → it errored.
--
-- Fix: qualify the column as `quiz_sessions.id`.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_session_activity(
  p_session_id UUID,
  p_limit      INT DEFAULT 100
)
RETURNS TABLE (
  id            UUID,
  actor_name    TEXT,
  actor_email   TEXT,
  action_type   TEXT,
  message       TEXT,
  details       JSONB,
  risk_score    INTEGER,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Must be the session owner OR an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.quiz_sessions qs
    WHERE qs.id = p_session_id AND qs.owner_id = auth.uid()
  ) AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT al.id,
         COALESCE(p.full_name, split_part(COALESCE(p.email, ''), '@', 1), 'Unknown user') AS actor_name,
         p.email AS actor_email,
         al.action_type,
         al.message,
         al.details,
         al.risk_score,
         al.created_at
  FROM public.activity_logs al
  LEFT JOIN public.profiles p ON p.id = al.actor_user_id
  WHERE al.entity_type = 'quiz_session' AND al.entity_id = p_session_id
  ORDER BY al.created_at DESC
  LIMIT GREATEST(1, LEAST(500, COALESCE(p_limit, 100)));
END;
$$;
