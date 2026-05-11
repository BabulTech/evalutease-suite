-- Lightweight host leaderboard payload for live quiz screens.
-- Keeps nested quiz_answers out of the active-session refresh path.

CREATE OR REPLACE FUNCTION public.get_session_leaderboard(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner UUID;
  v_rows JSONB;
BEGIN
  SELECT owner_id INTO v_owner
  FROM public.quiz_sessions
  WHERE id = p_session_id;

  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF auth.uid() IS DISTINCT FROM v_owner AND NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'participant_name', a.participant_name,
        'participant_email', a.participant_email,
        'participant_id', a.participant_id,
        'completed', a.completed,
        'completed_at', a.completed_at,
        'score', a.score,
        'total_questions', a.total_questions,
        'metadata', COALESCE(p.metadata, '{}'::jsonb)
      )
      ORDER BY a.started_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_rows
  FROM public.quiz_attempts a
  LEFT JOIN public.participants p ON p.id = a.participant_id
  WHERE a.session_id = p_session_id;

  RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_leaderboard(UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';
