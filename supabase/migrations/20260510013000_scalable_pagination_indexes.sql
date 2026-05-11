-- Stage: scalable pagination + sorting support for high-volume quiz sessions.
-- Adds missing indexes used by leaderboard/lobby/reports/history queries.

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_session_status_score
  ON public.quiz_attempts (session_id, completed, score DESC, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_session_started
  ON public.quiz_attempts (session_id, started_at ASC);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_session_completed_at
  ON public.quiz_attempts (session_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_participant_started
  ON public.quiz_attempts (participant_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_answers_attempt_answered
  ON public.quiz_answers (attempt_id, answered_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_owner_status_created
  ON public.quiz_sessions (owner_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_status_created
  ON public.quiz_sessions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_participants_owner_created
  ON public.participants (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_participants_subtype_created
  ON public.participants (subtype_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
