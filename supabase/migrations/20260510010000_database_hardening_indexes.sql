-- Production database hardening for live multi-session quiz load.
-- These indexes target the real hot paths used by participant join/play,
-- batched answer submission, host live monitoring, reports, and roster lookup.

-- ===== quiz_sessions =====
-- Owner dashboards, active counts, recent sessions, and completed reports.
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_owner_created_desc
  ON public.quiz_sessions(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_owner_status_created_desc
  ON public.quiz_sessions(owner_id, status, created_at DESC);

-- Scheduled-session dashboard and cron wakeups.
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_owner_status_scheduled
  ON public.quiz_sessions(owner_id, status, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- Public join path. access_code is already indexed/unique in the base schema,
-- but this partial index keeps the QR/live lookup small in production.
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_qr_open_code
  ON public.quiz_sessions(access_code)
  WHERE mode = 'qr_link' AND is_open = TRUE;

-- ===== quiz_attempts =====
-- Host live leaderboard and detailed attendee view.
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_session_started
  ON public.quiz_attempts(session_id, started_at ASC);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_session_completed_started
  ON public.quiz_attempts(session_id, completed, started_at ASC);

-- Reports/history frequently group attempts by session and sort/rank by score.
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_session_score
  ON public.quiz_attempts(session_id, score DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_session_completed_at
  ON public.quiz_attempts(session_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

-- Participant drill-down pages fetch all attempts for one participant.
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_participant_completed_at
  ON public.quiz_attempts(participant_id, completed_at DESC)
  WHERE participant_id IS NOT NULL;

-- Load-test cleanup/reporting and support queries by email within a session.
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_session_participant_email
  ON public.quiz_attempts(session_id, participant_email);

-- ===== quiz_answers =====
-- Enforce one answer per attempt/question. This protects the live submit path
-- from double-clicks/retries/races better than an application-only EXISTS check.
WITH ranked_answers AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY attempt_id, question_id
      ORDER BY answered_at ASC, id ASC
    ) AS rn
  FROM public.quiz_answers
)
DELETE FROM public.quiz_answers qa
USING ranked_answers ranked
WHERE qa.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_answers_attempt_question
  ON public.quiz_answers(attempt_id, question_id);

CREATE INDEX IF NOT EXISTS idx_quiz_answers_question
  ON public.quiz_answers(question_id);

CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt_answered_at
  ON public.quiz_answers(attempt_id, answered_at DESC);

-- ===== participants =====
-- Join RPC finds a participant by owner + lower(email).
CREATE INDEX IF NOT EXISTS idx_participants_owner_lower_email
  ON public.participants(owner_id, lower(COALESCE(email, '')));

-- Roster/admin participant screens list participants by owner/subtype/date.
CREATE INDEX IF NOT EXISTS idx_participants_owner_created_desc
  ON public.participants(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_participants_owner_subtype_created_desc
  ON public.participants(owner_id, subtype_id, created_at DESC)
  WHERE subtype_id IS NOT NULL;

-- ===== session join tables =====
-- quiz_session_questions already has UNIQUE(session_id, question_id), but the
-- ordered question delivery benefits from session_id + position.
CREATE INDEX IF NOT EXISTS idx_quiz_session_questions_session_position
  ON public.quiz_session_questions(session_id, position ASC);

CREATE INDEX IF NOT EXISTS idx_quiz_session_questions_question
  ON public.quiz_session_questions(question_id);

-- Primary key is (session_id, participant_id); this reverse index supports FK
-- checks and participant-centric joins.
CREATE INDEX IF NOT EXISTS idx_quiz_session_participants_participant
  ON public.quiz_session_participants(participant_id);

-- Refresh planner statistics after adding indexes so EXPLAIN is meaningful.
ANALYZE public.quiz_sessions;
ANALYZE public.quiz_attempts;
ANALYZE public.quiz_answers;
ANALYZE public.participants;
ANALYZE public.quiz_session_questions;
ANALYZE public.quiz_session_participants;
