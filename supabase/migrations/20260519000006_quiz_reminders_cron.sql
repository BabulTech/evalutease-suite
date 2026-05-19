-- Schedule the quiz-reminders Edge Function to run every minute via pg_cron.
-- This sends a 5-minute reminder email to all roster participants before a
-- scheduled private quiz starts.

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not installed — skipping quiz-reminders cron job.';
    RETURN;
  END IF;

  -- Remove old job if it exists
  PERFORM cron.unschedule('quiz-reminders')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'quiz-reminders'
  );

  -- Replace SUPABASE_URL and SERVICE_ROLE_KEY with your actual values before running.
  PERFORM cron.schedule(
    'quiz-reminders',
    '* * * * *',
    $job$
      SELECT net.http_post(
        url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/quiz-reminders',
        headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
        body    := '{}'::jsonb
      );
    $job$
  );
END
$do$;
