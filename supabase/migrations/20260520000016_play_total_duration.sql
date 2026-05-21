-- Add total_duration_seconds to get_session_for_play so the participant page
-- can show a quiz-level countdown timer.

CREATE OR REPLACE FUNCTION public.get_session_for_play(
  p_access_code TEXT,
  p_attempt_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session  quiz_sessions%ROWTYPE;
  v_attempt  quiz_attempts%ROWTYPE;
  v_settings host_settings%ROWTYPE;
  v_questions JSONB;
  v_total INT;
  v_duration INT;
BEGIN
  SELECT * INTO v_session
  FROM quiz_sessions
  WHERE access_code = upper(trim(p_access_code));

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT * INTO v_attempt
  FROM quiz_attempts
  WHERE id = p_attempt_id AND session_id = v_session.id;

  IF v_attempt.id IS NULL THEN
    RETURN jsonb_build_object('error', 'attempt_not_found');
  END IF;

  SELECT * INTO v_settings FROM host_settings WHERE owner_id = v_session.owner_id;

  SELECT count(*) INTO v_total
  FROM quiz_session_questions WHERE session_id = v_session.id;

  SELECT COALESCE(SUM(
    COALESCE(sq.time_seconds, q.time_seconds, v_session.default_time_per_question)
  ), 0)::INT INTO v_duration
  FROM quiz_session_questions sq
  JOIN questions q ON q.id = sq.question_id
  WHERE sq.session_id = v_session.id;

  IF v_session.status IN ('active', 'completed') THEN
    SELECT jsonb_agg(jsonb_build_object(
      'id',           q.id,
      'text',         q.text,
      'type',         CASE
                        WHEN q.type IS NOT NULL THEN q.type::TEXT
                        WHEN q.model_answer IS NOT NULL OR q.rubric IS NOT NULL THEN 'long_answer'
                        WHEN q.acceptable_answers IS NOT NULL
                             AND array_length(q.acceptable_answers, 1) > 0 THEN 'short_answer'
                        WHEN jsonb_array_length(q.options) = 2
                             AND q.correct_answer IN ('true', 'false') THEN 'true_false'
                        ELSE 'mcq'
                      END,
      'options',      q.options,
      'position',     sq.position,
      'time_seconds', COALESCE(sq.time_seconds, q.time_seconds, v_session.default_time_per_question)
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
      'total_questions',           COALESCE(v_total, 0),
      'show_results_after_quiz',   v_session.show_results_after_quiz,
      'total_duration_seconds',    v_duration
    ),
    'registration_fields',         COALESCE(v_settings.registration_fields, '{"name":{"visible":true,"required":true}}'::jsonb),
    'registration_fields_by_type', COALESCE(v_settings.registration_fields_by_type, '{}'::jsonb),
    'questions', COALESCE(v_questions, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_for_play(TEXT, UUID) TO anon, authenticated;
