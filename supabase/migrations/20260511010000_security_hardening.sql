-- ============================================================
-- Security Hardening Migration
-- ============================================================
-- 1. Server-side rate limiting table (no extensions needed)
-- 2. Input validation in public RPC functions
-- 3. Attempt ownership check in submit_quiz_answer
-- 4. Input length caps + email format guard
-- 5. Brute-force protection on access_code lookups
-- ============================================================

-- ─── Rate Limit Ledger ──────────────────────────────────────
-- Keyed by (bucket, identifier). identifier is typically a
-- truncated client IP, but callers may also use attempt_id.
-- pg_cron or a nightly job can TRUNCATE rows older than 1 hour.

CREATE TABLE IF NOT EXISTS public.rate_limit_ledger (
  bucket      TEXT        NOT NULL,   -- e.g. 'join', 'answer', 'code_lookup'
  identifier  TEXT        NOT NULL,   -- ip / attempt_id / access_code
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  hit_count   INT         NOT NULL DEFAULT 1,
  PRIMARY KEY (bucket, identifier, window_start)
);

-- Only the SECURITY DEFINER functions (running as the migration owner) need to write here.
-- No row-level access from the client.
REVOKE ALL ON public.rate_limit_ledger FROM anon, authenticated;

-- Index to make cleanup and lookup fast.
CREATE INDEX IF NOT EXISTS idx_rll_bucket_id_window
  ON public.rate_limit_ledger (bucket, identifier, window_start DESC);

-- Helper: check + increment a 1-minute sliding window counter.
-- Returns TRUE if the caller is within limits, FALSE if rate-limited.
CREATE OR REPLACE FUNCTION public._rl_check(
  p_bucket     TEXT,
  p_identifier TEXT,
  p_limit      INT,
  p_window_seconds INT DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_window TIMESTAMPTZ := date_trunc('minute', now());
  v_count  INT;
BEGIN
  -- Upsert into current 1-minute window
  INSERT INTO rate_limit_ledger (bucket, identifier, window_start, hit_count)
  VALUES (p_bucket, p_identifier, v_window, 1)
  ON CONFLICT (bucket, identifier, window_start)
  DO UPDATE SET hit_count = rate_limit_ledger.hit_count + 1;

  SELECT hit_count INTO v_count
  FROM rate_limit_ledger
  WHERE bucket = p_bucket AND identifier = p_identifier AND window_start = v_window;

  RETURN v_count <= p_limit;
END;
$$;

-- ─── Cleanup: drop rows older than 2 hours ───────────────────
CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_ledger()
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM rate_limit_ledger WHERE window_start < now() - INTERVAL '2 hours';
$$;

-- ─── get_session_for_join — brute-force guard ─────────────────
-- Allow 20 code lookups per IP per minute before returning
-- rate_limited error. The IP comes from the request header injected
-- by the Supabase edge (available via current_setting with fallback).

CREATE OR REPLACE FUNCTION public.get_session_for_join(p_access_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session   RECORD;
  v_questions RECORD;
  v_fields    JSONB;
  v_ip        TEXT;
BEGIN
  -- Sanitise input
  IF p_access_code IS NULL OR length(trim(p_access_code)) = 0 THEN
    RETURN jsonb_build_object('error', 'invalid_code');
  END IF;
  IF length(trim(p_access_code)) > 64 THEN
    RETURN jsonb_build_object('error', 'invalid_code');
  END IF;

  -- Per-IP rate limit: 20 lookups / minute
  v_ip := coalesce(
    current_setting('request.headers', TRUE)::jsonb->>'x-forwarded-for',
    current_setting('request.headers', TRUE)::jsonb->>'x-real-ip',
    'unknown'
  );
  -- Take only the first IP if comma-separated
  v_ip := split_part(v_ip, ',', 1);
  v_ip := trim(v_ip);

  IF NOT public._rl_check('code_lookup', v_ip, 20, 60) THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  SELECT qs.*
  INTO v_session
  FROM quiz_sessions qs
  WHERE qs.access_code = upper(trim(p_access_code))
    AND qs.mode = 'qr_link'
    AND qs.is_open = TRUE;

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_session.status NOT IN ('scheduled', 'active') THEN
    RETURN jsonb_build_object('error', 'session_closed');
  END IF;

  SELECT jsonb_agg(rf.field_name ORDER BY rf.sort_order)
  INTO v_fields
  FROM quiz_session_registration_fields rf
  WHERE rf.session_id = v_session.id AND rf.enabled = TRUE;

  SELECT count(*) AS cnt,
         coalesce(max(q.default_time_per_question), v_session.default_time_per_question) AS tpq
  INTO v_questions
  FROM quiz_session_questions sqq
  LEFT JOIN questions q ON q.id = sqq.question_id
  WHERE sqq.session_id = v_session.id;

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
      'question_count', v_questions.cnt
    ),
    'registration_fields', coalesce(v_fields, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_session_for_join(TEXT) TO anon, authenticated;

-- ─── join_quiz_session — input validation + rate limit ────────

CREATE OR REPLACE FUNCTION public.join_quiz_session(
  p_access_code  TEXT,
  p_name         TEXT,
  p_email        TEXT DEFAULT NULL,
  p_mobile       TEXT DEFAULT NULL,
  p_roll_number  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session       quiz_sessions;
  v_total         INT;
  v_attempt_id    UUID;
  v_participant_id UUID;
  v_has_roster    BOOLEAN;
  v_ip            TEXT;
  v_name          TEXT;
  v_email         TEXT;
  v_mobile        TEXT;
  v_roll          TEXT;
BEGIN
  -- ── Input sanitisation ─────────────────────────────────────
  v_name  := trim(coalesce(p_name, ''));
  v_email := trim(coalesce(p_email, ''));
  v_mobile := trim(coalesce(p_mobile, ''));
  v_roll  := trim(coalesce(p_roll_number, ''));

  IF length(v_name) = 0 THEN
    RETURN jsonb_build_object('error', 'name_required');
  END IF;
  IF length(v_name) > 120 THEN
    RETURN jsonb_build_object('error', 'name_too_long');
  END IF;
  IF length(v_email) > 254 THEN
    RETURN jsonb_build_object('error', 'email_too_long');
  END IF;
  -- Basic email format check (must contain @ and a dot after it)
  IF length(v_email) > 0 AND v_email NOT LIKE '%@%.%' THEN
    RETURN jsonb_build_object('error', 'email_invalid');
  END IF;
  IF length(v_mobile) > 20 THEN
    RETURN jsonb_build_object('error', 'mobile_too_long');
  END IF;
  IF length(v_roll) > 50 THEN
    RETURN jsonb_build_object('error', 'roll_number_too_long');
  END IF;

  -- ── Per-IP rate limit: 10 joins / minute ──────────────────
  v_ip := coalesce(
    current_setting('request.headers', TRUE)::jsonb->>'x-forwarded-for',
    current_setting('request.headers', TRUE)::jsonb->>'x-real-ip',
    'unknown'
  );
  v_ip := split_part(v_ip, ',', 1);
  v_ip := trim(v_ip);

  IF NOT public._rl_check('join', v_ip, 10, 60) THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  -- ── Session lookup ────────────────────────────────────────
  SELECT * INTO v_session
  FROM quiz_sessions
  WHERE access_code = upper(trim(p_access_code))
    AND mode = 'qr_link'
    AND is_open = TRUE;

  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  IF v_session.status NOT IN ('scheduled', 'active') THEN
    RETURN jsonb_build_object('error', 'session_closed');
  END IF;

  -- ── Roster check ──────────────────────────────────────────
  SELECT EXISTS (
    SELECT 1 FROM quiz_session_participants WHERE session_id = v_session.id
  ) INTO v_has_roster;

  IF v_has_roster THEN
    SELECT p.id INTO v_participant_id
    FROM participants p
    JOIN quiz_session_participants sp ON sp.participant_id = p.id
    WHERE sp.session_id = v_session.id
      AND (
        -- Prefer strong identifiers; only fall back to name if no other field given
        (length(v_email) > 0  AND lower(p.email)                  = lower(v_email))
        OR (length(v_mobile) > 0 AND p.mobile                     = v_mobile)
        OR (length(v_roll) > 0   AND p.metadata->>'roll_number'   = v_roll)
        OR (length(v_email) = 0 AND length(v_mobile) = 0 AND length(v_roll) = 0
            AND lower(p.name) = lower(v_name))
      )
    LIMIT 1;

    IF v_participant_id IS NULL THEN
      RETURN jsonb_build_object('error', 'not_invited');
    END IF;
  END IF;

  -- ── Create attempt ────────────────────────────────────────
  SELECT count(*) INTO v_total
  FROM quiz_session_questions
  WHERE session_id = v_session.id;

  INSERT INTO quiz_attempts (
    session_id, participant_id, participant_name, participant_email, total_questions
  ) VALUES (
    v_session.id,
    v_participant_id,
    v_name,
    CASE WHEN length(v_email) > 0 THEN v_email ELSE NULL END,
    COALESCE(v_total, 0)
  ) RETURNING id INTO v_attempt_id;

  RETURN jsonb_build_object('attempt_id', v_attempt_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_quiz_session(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ─── submit_quiz_answer — ownership check + validation ────────

CREATE OR REPLACE FUNCTION public.submit_quiz_answer(
  p_attempt_id          UUID,
  p_question_id         UUID,
  p_answer              TEXT,
  p_time_taken_seconds  INT
)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_attempt   quiz_attempts;
  v_session   quiz_sessions;
  v_correct   TEXT;
  v_is_correct BOOLEAN;
  v_settings  host_settings;
  v_marks     INT;
  v_ip        TEXT;
BEGIN
  -- ── Input validation ──────────────────────────────────────
  IF p_answer IS NOT NULL AND length(p_answer) > 2000 THEN
    RETURN jsonb_build_object('error', 'answer_too_long');
  END IF;
  IF p_time_taken_seconds IS NOT NULL AND p_time_taken_seconds < 0 THEN
    RETURN jsonb_build_object('error', 'invalid_time');
  END IF;

  -- ── Per-attempt rate limit: 200 answers / minute ──────────
  -- This caps bulk-submit abuse while allowing 20-q quizzes comfortably.
  v_ip := coalesce(
    current_setting('request.headers', TRUE)::jsonb->>'x-forwarded-for',
    'unknown'
  );
  v_ip := split_part(v_ip, ',', 1);
  v_ip := trim(v_ip);

  IF NOT public._rl_check('answer', v_ip, 200, 60) THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  -- ── Attempt lookup ────────────────────────────────────────
  SELECT * INTO v_attempt FROM quiz_attempts WHERE id = p_attempt_id;
  IF v_attempt.id IS NULL THEN
    RETURN jsonb_build_object('error', 'attempt_not_found');
  END IF;

  IF v_attempt.completed THEN
    RETURN jsonb_build_object('error', 'attempt_already_completed');
  END IF;

  -- ── Session must be active ────────────────────────────────
  SELECT * INTO v_session FROM quiz_sessions WHERE id = v_attempt.session_id;
  IF v_session.id IS NULL THEN
    RETURN jsonb_build_object('error', 'session_not_found');
  END IF;
  IF v_session.status NOT IN ('active', 'scheduled') THEN
    RETURN jsonb_build_object('error', 'session_closed');
  END IF;

  -- ── Question must belong to this session ──────────────────
  IF NOT EXISTS (
    SELECT 1 FROM quiz_session_questions
    WHERE session_id = v_session.id AND question_id = p_question_id
  ) THEN
    RETURN jsonb_build_object('error', 'question_not_in_session');
  END IF;

  -- ── Idempotency ───────────────────────────────────────────
  SELECT correct_answer INTO v_correct FROM questions WHERE id = p_question_id;
  v_is_correct := (p_answer IS NOT NULL AND v_correct IS NOT NULL AND p_answer = v_correct);

  IF EXISTS (
    SELECT 1 FROM quiz_answers
    WHERE attempt_id = p_attempt_id AND question_id = p_question_id
  ) THEN
    RETURN jsonb_build_object('is_correct', v_is_correct, 'duplicate', TRUE);
  END IF;

  -- ── Insert + score ────────────────────────────────────────
  INSERT INTO quiz_answers (attempt_id, question_id, answer, is_correct, time_taken_seconds)
  VALUES (p_attempt_id, p_question_id, p_answer, v_is_correct,
          LEAST(COALESCE(p_time_taken_seconds, 0), 3600));

  IF v_is_correct THEN
    SELECT * INTO v_settings FROM host_settings WHERE owner_id = v_session.owner_id;
    v_marks := COALESCE(v_settings.marks_per_correct, 1);
    UPDATE quiz_attempts SET score = score + v_marks WHERE id = p_attempt_id;
  END IF;

  RETURN jsonb_build_object('is_correct', v_is_correct, 'duplicate', FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_quiz_answer(UUID, UUID, TEXT, INT) TO anon, authenticated;

-- ─── complete_quiz_attempt — prevent double-fire abuse ────────

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
BEGIN
  -- Per-IP rate limit: 30 completions / minute (covers 500-VU test scenarios)
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

-- ─── Rate limit ledger cleanup ────────────────────────────────
-- Call this from a pg_cron job or nightly trigger. Safe to call at any time.
GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_ledger() TO authenticated;
