-- Fix get_session_for_join:
--   1. VOLATILE (was STABLE) so PostgREST allows the rate-limit INSERT
--   2. Remove quiz_session_registration_fields (table does not exist)
--   3. Remove q.default_time_per_question (column not on questions table)

CREATE OR REPLACE FUNCTION public.get_session_for_join(p_access_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session  quiz_sessions%ROWTYPE;
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
  FROM quiz_sessions qs
  WHERE qs.access_code = upper(trim(p_access_code))
    AND qs.is_open = TRUE;

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_session.status NOT IN ('scheduled', 'active') THEN
    RETURN jsonb_build_object('error', 'session_closed');
  END IF;

  SELECT count(*)
  INTO v_cnt
  FROM quiz_session_questions
  WHERE session_id = v_session.id;

  RETURN jsonb_build_object(
    'session', jsonb_build_object(
      'id',             v_session.id,
      'title',          v_session.title,
      'status',         v_session.status,
      'access_code',    v_session.access_code,
      'subject',        v_session.subject,
      'description',    v_session.description,
      'scheduled_at',   v_session.scheduled_at,
      'time_per_q',     v_session.default_time_per_question,
      'question_count', v_cnt
    ),
    'registration_fields', '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_for_join(TEXT) TO anon, authenticated;
