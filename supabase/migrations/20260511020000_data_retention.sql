-- ============================================================
-- Data Retention & Cleanup Strategy
-- ============================================================
-- Quiz apps accumulate data fast:
--   quiz_answers  → ~20 rows per student per session
--   quiz_attempts → ~1 row per student per session
--   quiz_sessions → grows indefinitely
--
-- Strategy:
--   LIVE   (< 90 days)  — in main tables, fully indexed, fast
--   WARM   (90–365 days) — still in main tables, but older sessions
--                          marked archived; UI hides by default
--   COLD   (> 365 days) — answers pruned; attempt summaries kept;
--                          sessions kept forever (lightweight)
--
-- The archive_old_sessions() function is idempotent and safe to
-- call repeatedly. Wire it to pg_cron or a Supabase Edge Function
-- scheduled job.
-- ============================================================

-- ─── 1. Mark archived sessions ───────────────────────────────
-- Add a non-breaking column to quiz_sessions if not present.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'quiz_sessions'
      AND column_name  = 'archived_at'
  ) THEN
    ALTER TABLE public.quiz_sessions ADD COLUMN archived_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_archived
  ON public.quiz_sessions (archived_at)
  WHERE archived_at IS NULL;  -- partial index keeps live queries fast

-- ─── 2. Retention policy function ────────────────────────────
-- Call: SELECT archive_old_sessions();
-- Behaviour:
--   a) Sessions completed > 365 days ago → delete their quiz_answers
--      (attempt summaries: score, total_questions, completed_at → KEPT)
--   b) Sessions completed > 90 days ago  → mark archived_at
--   c) Orphaned incomplete attempts (session completed > 30 days ago,
--      attempt never finished) → mark completed=true with score=0

CREATE OR REPLACE FUNCTION public.archive_old_sessions(
  p_answer_retention_days   INT DEFAULT 365,
  p_archive_after_days      INT DEFAULT 90,
  p_orphan_cleanup_days     INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_answers_deleted  BIGINT := 0;
  v_sessions_archived BIGINT := 0;
  v_orphans_closed   BIGINT := 0;
BEGIN
  -- ── a) Prune answers for old completed sessions ────────────
  WITH old_sessions AS (
    SELECT id FROM quiz_sessions
    WHERE status = 'completed'
      AND completed_at < now() - make_interval(days => p_answer_retention_days)
  )
  DELETE FROM quiz_answers
  WHERE attempt_id IN (
    SELECT qa.id FROM quiz_attempts qa
    JOIN old_sessions os ON os.id = qa.session_id
  );
  GET DIAGNOSTICS v_answers_deleted = ROW_COUNT;

  -- ── b) Archive sessions older than archive_after_days ─────
  UPDATE quiz_sessions
  SET archived_at = now()
  WHERE status = 'completed'
    AND archived_at IS NULL
    AND completed_at < now() - make_interval(days => p_archive_after_days);
  GET DIAGNOSTICS v_sessions_archived = ROW_COUNT;

  -- ── c) Close orphaned incomplete attempts ─────────────────
  -- Attempts that were started but the session completed > 30 days ago.
  UPDATE quiz_attempts
  SET completed    = TRUE,
      completed_at = coalesce(completed_at, now()),
      score        = coalesce(score, 0)
  WHERE completed = FALSE
    AND session_id IN (
      SELECT id FROM quiz_sessions
      WHERE status = 'completed'
        AND completed_at < now() - make_interval(days => p_orphan_cleanup_days)
    );
  GET DIAGNOSTICS v_orphans_closed = ROW_COUNT;

  -- ── d) Clean up rate limit ledger while we're here ────────
  PERFORM public.cleanup_rate_limit_ledger();

  RETURN jsonb_build_object(
    'answers_deleted',    v_answers_deleted,
    'sessions_archived',  v_sessions_archived,
    'orphans_closed',     v_orphans_closed,
    'ran_at',             now()
  );
END;
$$;

-- Teachers can call it themselves; admins can too.
GRANT EXECUTE ON FUNCTION public.archive_old_sessions(INT, INT, INT) TO authenticated;

-- ─── 3. Expose archived flag to dashboard queries ─────────────
-- Update the RLS policies so teachers only see non-archived by default
-- but can still fetch archived ones if they explicitly ask.
-- (No RLS change needed — filtering happens in the app query with
--  .is('archived_at', null) for live view, omit filter for archive view.)

-- ─── 4. Useful stats view (owner-scoped) ─────────────────────
CREATE OR REPLACE VIEW public.session_storage_stats AS
SELECT
  qs.owner_id,
  count(DISTINCT qs.id)                                     AS total_sessions,
  count(DISTINCT qs.id) FILTER (WHERE qs.archived_at IS NULL) AS live_sessions,
  count(DISTINCT qs.id) FILTER (WHERE qs.archived_at IS NOT NULL) AS archived_sessions,
  count(DISTINCT qa.id)                                     AS total_attempts,
  count(DISTINCT ans.id)                                    AS total_answers,
  pg_size_pretty(
    count(DISTINCT ans.id) * 200   -- rough bytes per answer row
  )                                                         AS est_answer_storage
FROM quiz_sessions qs
LEFT JOIN quiz_attempts qa  ON qa.session_id = qs.id
LEFT JOIN quiz_answers  ans ON ans.attempt_id = qa.id
WHERE qs.owner_id = auth.uid()
GROUP BY qs.owner_id;

-- ─── 5. Completed_at column on quiz_sessions ─────────────────
-- Some queries above reference quiz_sessions.completed_at.
-- Add it if the column doesn't exist yet.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'quiz_sessions'
      AND column_name  = 'completed_at'
  ) THEN
    ALTER TABLE public.quiz_sessions ADD COLUMN completed_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- Backfill completed_at from started_at for already-completed sessions
-- (Use a conservative estimate since the real timestamp may be lost.)
UPDATE public.quiz_sessions
SET completed_at = updated_at
WHERE status = 'completed'
  AND completed_at IS NULL
  AND updated_at IS NOT NULL;

-- Keep completed_at up to date automatically via a trigger.
CREATE OR REPLACE FUNCTION public._set_session_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_completed_at ON public.quiz_sessions;
CREATE TRIGGER trg_session_completed_at
  BEFORE UPDATE ON public.quiz_sessions
  FOR EACH ROW EXECUTE FUNCTION public._set_session_completed_at();

-- ─── 6. Future optimization index hints ──────────────────────
-- These support the retention queries without full-table scans.

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_completed_at
  ON public.quiz_sessions (completed_at)
  WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_session_completed
  ON public.quiz_attempts (session_id, completed);

-- ─── Scheduling instructions ─────────────────────────────────
-- A GitHub Actions workflow (.github/workflows/nightly-cleanup.yml)
-- calls this function nightly via the Supabase REST API.
--
-- Add two repository secrets in GitHub → Settings → Secrets:
--   SUPABASE_URL              https://jfwnyktkzhnblpmtamke.supabase.co
--   SUPABASE_SERVICE_ROLE_KEY  (the service_role JWT from Supabase dashboard)
--
-- Manual call anytime from the SQL Editor:
--   SELECT public.archive_old_sessions();
--
-- Default retention windows:
--   answer_retention_days = 365  (delete detailed answers after 1 year)
--   archive_after_days    = 90   (hide from default dashboard after 90 days)
--   orphan_cleanup_days   = 30   (close abandoned attempts after 30 days)
--
-- Custom values:
--   SELECT public.archive_old_sessions(180, 60, 14);
