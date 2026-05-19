-- Add show_results_after_quiz flag to quiz_sessions.
-- When FALSE, participants see a "Quiz completed" screen WITHOUT their score.

ALTER TABLE public.quiz_sessions
  ADD COLUMN IF NOT EXISTS show_results_after_quiz BOOLEAN NOT NULL DEFAULT TRUE;

-- Re-create get_session_for_join to include the new flag.
-- Preserves the VOLATILE + rate-limit logic from 20260511030000.
CREATE OR REPLACE FUNCTION public.get_session_for_join(p_access_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session  public.quiz_sessions%ROWTYPE;
  v_settings public.host_settings%ROWTYPE;
  v_total    INT;
  v_cnt      BIGINT;
  v_ip       TEXT;
BEGIN
  v_ip := coalesce(
    split_part(trim(current_setting('request.headers', true)::jsonb->>'x-forwarded-for'), ',', 1),
    current_setting('request.headers', true)::jsonb->>'x-real-ip',
    'unknown'
  );
  v_ip := trim(v_ip);

  IF NOT public._rl_check('code_lookup', v_ip, 20, 60) THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  SELECT qs.*
  INTO v_session
  FROM public.quiz_sessions qs
  WHERE qs.access_code = upper(trim(p_access_code))
    AND qs.is_open = TRUE;

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_session.status NOT IN ('scheduled', 'active') THEN
    RETURN jsonb_build_object('error', 'session_closed');
  END IF;

  SELECT * INTO v_settings
  FROM public.host_settings
  WHERE owner_id = v_session.owner_id;

  SELECT count(*) INTO v_total
  FROM public.quiz_session_questions
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
      'total_questions',           COALESCE(v_total, 0),
      'show_results_after_quiz',   v_session.show_results_after_quiz
    ),
    'registration_fields', COALESCE(v_settings.registration_fields, '{
      "name": {"visible": true, "required": true}
    }'::jsonb),
    'questions', '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_for_join(TEXT) TO anon, authenticated;
