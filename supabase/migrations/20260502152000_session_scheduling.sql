-- ===== SESSION SCHEDULING + CATEGORY LINK =====
-- Adds the columns the Generate-QR-Session form needs and a pg_cron job
-- that auto-flips scheduled sessions to "active" once their start time hits.

ALTER TABLE public.quiz_sessions
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS category_id UUID NULL REFERENCES public.question_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_scheduled
  ON public.quiz_sessions(scheduled_at)
  WHERE scheduled_at IS NOT NULL AND status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_category
  ON public.quiz_sessions(category_id);

-- ===== AUTO-START SCHEDULED SESSIONS =====
-- Requires the pg_cron extension. Enable it in the Supabase dashboard:
--   Database -> Extensions -> search "pg_cron" -> Enable
-- Then re-run this migration (the DO block below is idempotent).
-- Until pg_cron is enabled, this block is a no-op (scheduled sessions
-- can still be created — they just won't auto-start).

DO $do$
DECLARE
  v_jobid bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed — skipping auto-start cron job. Enable pg_cron in the Supabase dashboard and re-run this migration.';
    RETURN;
  END IF;

  -- Drop any prior version of the job so this is safely re-runnable
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
      SET status = 'active'
      WHERE status = 'scheduled'
        AND scheduled_at IS NOT NULL
        AND scheduled_at <= now();
    $job$
  );
END
$do$;
