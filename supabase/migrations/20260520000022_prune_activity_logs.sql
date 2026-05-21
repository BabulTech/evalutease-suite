-- ============================================================
-- Activity log retention
-- Deletes old rows from activity_logs to keep the table fast and
-- storage bounded. Two retention windows:
--   * High-volume "noise" rows (quiz_session_questions,
--     quiz_session_participants, quiz_session_subtypes,
--     participant_group_members, quiz_answers INSERT) → 30 days
--   * Everything else (sessions, billing, admin actions,
--     auth events) → 365 days
-- Tune the constants below to fit your storage / audit policy.
-- ============================================================

CREATE OR REPLACE FUNCTION public.prune_activity_logs(
  p_noise_days   INT DEFAULT 30,
  p_regular_days INT DEFAULT 365
) RETURNS TABLE (deleted_noise BIGINT, deleted_regular BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_noise BIGINT;
  v_reg   BIGINT;
BEGIN
  -- High-volume "noise" rows: tables that explode log volume during
  -- normal use. Keep only recent N days.
  WITH del AS (
    DELETE FROM public.activity_logs
    WHERE created_at < now() - (p_noise_days || ' days')::INTERVAL
      AND entity_type IN (
        'quiz_session_questions',
        'quiz_session_participants',
        'quiz_session_subtypes',
        'participant_group_members',
        'quiz_answer'
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_noise FROM del;

  -- Everything else: full retention window.
  WITH del AS (
    DELETE FROM public.activity_logs
    WHERE created_at < now() - (p_regular_days || ' days')::INTERVAL
      AND entity_type NOT IN (
        'quiz_session_questions',
        'quiz_session_participants',
        'quiz_session_subtypes',
        'participant_group_members',
        'quiz_answer'
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_reg FROM del;

  RETURN QUERY SELECT v_noise, v_reg;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_activity_logs(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_activity_logs(INT, INT) TO service_role;

-- ─── Schedule via pg_cron if the extension exists ─────────────
-- Runs every day at 03:00 UTC. If pg_cron isn't enabled, call this
-- function from an edge function on a daily Vercel cron / Supabase
-- scheduled function instead.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('prune-activity-logs')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-activity-logs');
    PERFORM cron.schedule(
      'prune-activity-logs',
      '0 3 * * *',
      $cron$SELECT public.prune_activity_logs(30, 365)$cron$
    );
  END IF;
END
$$;
