-- ===== PHASE 3: Live delivery + host settings =====
-- Adds started_at to track actual go-live (vs. scheduled_at, which is the planned start),
-- creates host_settings (registration form config + scoring rules),
-- enables Realtime publication on quiz_sessions / quiz_attempts so participants and
-- the host lobby get push updates, and exposes 4 SECURITY DEFINER RPCs that anon clients
-- use to play a quiz without ever seeing correct_answer or unrelated host data.

ALTER TABLE public.quiz_sessions
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NULL;

-- ===== HOST SETTINGS =====
CREATE TABLE IF NOT EXISTS public.host_settings (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  registration_fields JSONB NOT NULL DEFAULT '{
    "name":         {"visible": true,  "required": true},
    "email":        {"visible": true,  "required": false},
    "mobile":       {"visible": false, "required": false},
    "roll_number":  {"visible": true,  "required": false},
    "seat_number":  {"visible": false, "required": false},
    "class":        {"visible": false, "required": false},
    "organization": {"visible": false, "required": false}
  }'::jsonb,
  marks_per_correct INTEGER NOT NULL DEFAULT 1,
  speed_bonus_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  speed_bonus_max INTEGER NOT NULL DEFAULT 1,
  show_explanation BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.host_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Host manages own settings" ON public.host_settings;
CREATE POLICY "Host manages own settings" ON public.host_settings
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP TRIGGER IF EXISTS host_settings_touch ON public.host_settings;
CREATE TRIGGER host_settings_touch BEFORE UPDATE ON public.host_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== REALTIME PUBLICATION =====
-- Required so participants see status flips and the host's lobby gets join events.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_sessions;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_attempts;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ===== UPDATED CRON: scheduled sessions auto-start AND get started_at =====
DO $do$
DECLARE
  v_jobid bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed — skipping cron update.';
    RETURN;
  END IF;
  FOR v_jobid IN
    SELECT jobid FROM cron.job WHERE jobname = 'auto-start-scheduled-quiz-sessions'
  LOOP
    PERFORM cron.unschedule(v_jobid);
  END LOOP;
  PERFORM cron.schedule(
    'auto-start-scheduled-quiz-sessions',
    '* * * * *',
    $job$
      UPDATE public.quiz_sessions
      SET status = 'active',
          started_at = COALESCE(started_at, now())
      WHERE status = 'scheduled'
        AND scheduled_at IS NOT NULL
        AND scheduled_at <= now();
    $job$
  );
END
$do$;

-- ===== get_session_for_join =====
-- What an anon client needs to either register or play. Hides correct_answer.
CREATE OR REPLACE FUNCTION public.get_session_for_join(p_access_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session quiz_sessions;
  v_settings host_settings;
  v_questions JSONB;
  v_total INT;
BEGIN
  SELECT * INTO v_session
  FROM quiz_sessions
  WHERE access_code = p_access_code
    AND mode = 'qr_link';

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT * INTO v_settings FROM host_settings WHERE owner_id = v_session.owner_id;

  SELECT count(*) INTO v_total
  FROM quiz_session_questions
  WHERE session_id = v_session.id;

  -- Questions are only revealed once the host has gone live
  IF v_session.status IN ('active', 'completed') THEN
    SELECT jsonb_agg(jsonb_build_object(
      'id',           q.id,
      'text',         q.text,
      'options',      q.options,
      'position',     sq.position,
      'time_seconds', COALESCE(sq.time_seconds, v_session.default_time_per_question)
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
      'default_time_per_question', v_session.default_time_per_question,
      'access_code',               v_session.access_code,
      'is_open',                   v_session.is_open,
      'total_questions',           COALESCE(v_total, 0)
    ),
    'registration_fields', COALESCE(v_settings.registration_fields, '{
      "name": {"visible": true, "required": true}
    }'::jsonb),
    'questions', COALESCE(v_questions, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_for_join(TEXT) TO anon, authenticated;

-- ===== join_quiz_session =====
-- Creates a quiz_attempts row, enforces closed-roster check.
CREATE OR REPLACE FUNCTION public.join_quiz_session(
  p_access_code TEXT,
  p_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_mobile TEXT DEFAULT NULL,
  p_roll_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session quiz_sessions;
  v_total INT;
  v_attempt_id UUID;
  v_participant_id UUID;
  v_has_roster BOOLEAN;
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN jsonb_build_object('error', 'name_required');
  END IF;

  SELECT * INTO v_session
  FROM quiz_sessions
  WHERE access_code = p_access_code
    AND mode = 'qr_link'
    AND is_open = TRUE;

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_session.status NOT IN ('scheduled', 'active') THEN
    RETURN jsonb_build_object('error', 'session_closed');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM quiz_session_participants WHERE session_id = v_session.id
  ) INTO v_has_roster;

  IF v_has_roster THEN
    SELECT p.id INTO v_participant_id
    FROM participants p
    JOIN quiz_session_participants sp ON sp.participant_id = p.id
    WHERE sp.session_id = v_session.id
      AND (
        (p_email IS NOT NULL AND length(trim(p_email)) > 0
          AND lower(p.email) = lower(trim(p_email)))
        OR (p_mobile IS NOT NULL AND length(trim(p_mobile)) > 0
          AND p.mobile = trim(p_mobile))
        OR (p_roll_number IS NOT NULL AND length(trim(p_roll_number)) > 0
          AND p.metadata->>'roll_number' = trim(p_roll_number))
        OR lower(p.name) = lower(trim(p_name))
      )
    LIMIT 1;

    IF v_participant_id IS NULL THEN
      RETURN jsonb_build_object('error', 'not_invited');
    END IF;
  END IF;

  SELECT count(*) INTO v_total
  FROM quiz_session_questions
  WHERE session_id = v_session.id;

  INSERT INTO quiz_attempts (
    session_id, participant_id, participant_name, participant_email, total_questions
  ) VALUES (
    v_session.id, v_participant_id, trim(p_name), p_email, COALESCE(v_total, 0)
  ) RETURNING id INTO v_attempt_id;

  RETURN jsonb_build_object('attempt_id', v_attempt_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_quiz_session(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ===== submit_quiz_answer =====
-- Server-side check of correct_answer + score increment. Idempotent per (attempt, question).
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
  v_attempt quiz_attempts;
  v_session quiz_sessions;
  v_correct TEXT;
  v_is_correct BOOLEAN;
  v_settings host_settings;
  v_marks INT;
BEGIN
  SELECT * INTO v_attempt FROM quiz_attempts WHERE id = p_attempt_id;
  IF v_attempt.id IS NULL THEN
    RETURN jsonb_build_object('error', 'attempt_not_found');
  END IF;

  SELECT * INTO v_session FROM quiz_sessions WHERE id = v_attempt.session_id;
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('error', 'session_not_found');
  END IF;

  -- Make sure the question actually belongs to this session
  IF NOT EXISTS (
    SELECT 1 FROM quiz_session_questions
    WHERE session_id = v_session.id AND question_id = p_question_id
  ) THEN
    RETURN jsonb_build_object('error', 'question_not_in_session');
  END IF;

  SELECT correct_answer INTO v_correct FROM questions WHERE id = p_question_id;
  v_is_correct := (p_answer IS NOT NULL AND v_correct IS NOT NULL AND p_answer = v_correct);

  IF EXISTS (
    SELECT 1 FROM quiz_answers
    WHERE attempt_id = p_attempt_id AND question_id = p_question_id
  ) THEN
    RETURN jsonb_build_object('is_correct', v_is_correct, 'duplicate', TRUE);
  END IF;

  INSERT INTO quiz_answers (attempt_id, question_id, answer, is_correct, time_taken_seconds)
  VALUES (p_attempt_id, p_question_id, p_answer, v_is_correct, p_time_taken_seconds);

  IF v_is_correct THEN
    SELECT * INTO v_settings FROM host_settings WHERE owner_id = v_session.owner_id;
    v_marks := COALESCE(v_settings.marks_per_correct, 1);
    UPDATE quiz_attempts SET score = score + v_marks WHERE id = p_attempt_id;
  END IF;

  RETURN jsonb_build_object('is_correct', v_is_correct, 'duplicate', FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(UUID, UUID, TEXT, INT) TO anon, authenticated;

-- ===== complete_quiz_attempt =====
-- Marks attempt as done, applies optional speed bonus, returns final score.
CREATE OR REPLACE FUNCTION public.complete_quiz_attempt(p_attempt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_attempt quiz_attempts;
  v_session quiz_sessions;
  v_settings host_settings;
  v_speed_bonus INT := 0;
  v_avg NUMERIC;
  v_final INT;
BEGIN
  SELECT * INTO v_attempt FROM quiz_attempts WHERE id = p_attempt_id;
  IF v_attempt.id IS NULL THEN
    RETURN jsonb_build_object('error', 'attempt_not_found');
  END IF;
  IF v_attempt.completed THEN
    RETURN jsonb_build_object(
      'score', v_attempt.score,
      'total', v_attempt.total_questions,
      'speed_bonus', 0,
      'already_completed', TRUE
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
    'already_completed', FALSE
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_quiz_attempt(UUID) TO anon, authenticated;
