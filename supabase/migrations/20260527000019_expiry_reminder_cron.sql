-- ============================================================
-- Plan expiry reminders + auto-downgrade
--
-- Runs daily via pg_cron:
--   * 7 days before expiry → "renew soon" notification (once)
--   * 1 day after expiry   → downgrade to free plan + "expired" notification
--
-- Tracks which reminders were already sent on the subscription row so we
-- don't spam users every day.
-- ============================================================

-- Track which reminders have fired so we don't re-send
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS renew_reminded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expired_notified_at TIMESTAMPTZ;

-- Helper: free plan IDs (for downgrade target)
-- Individual users → individual_starter; enterprise → enterprise_free.

CREATE OR REPLACE FUNCTION public.process_subscription_expiry()
RETURNS TABLE (reminded BIGINT, downgraded BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ind_free_id UUID;
  v_ent_free_id UUID;
  v_reminded BIGINT := 0;
  v_downgraded BIGINT := 0;
  r RECORD;
BEGIN
  SELECT id INTO v_ind_free_id FROM public.plans WHERE slug = 'individual_starter' LIMIT 1;
  SELECT id INTO v_ent_free_id FROM public.plans WHERE slug = 'enterprise_free'    LIMIT 1;

  -- 1) Renew-soon reminders (7 days before expiry, once)
  FOR r IN
    SELECT us.user_id, us.expires_at, p.name AS plan_name, p.tier
    FROM public.user_subscriptions us
    JOIN public.plans p ON p.id = us.plan_id
    WHERE us.status = 'active'
      AND us.expires_at IS NOT NULL
      AND us.expires_at > now()
      AND us.expires_at <= now() + INTERVAL '7 days'
      AND us.renew_reminded_at IS NULL
      AND p.price_pkr > 0  -- only paid plans
  LOOP
    PERFORM public.create_notification(
      r.user_id,
      'Your ' || r.plan_name || ' plan expires soon',
      'Your subscription ends on ' || to_char(r.expires_at, 'DD Mon YYYY') ||
      '. Renew to keep AI features and credits without interruption.',
      'warning',
      '/billing'
    );
    UPDATE public.user_subscriptions
      SET renew_reminded_at = now()
      WHERE user_id = r.user_id;
    v_reminded := v_reminded + 1;
  END LOOP;

  -- 2) Expired subscriptions → downgrade + notify (once)
  FOR r IN
    SELECT us.user_id, us.expires_at, p.name AS plan_name, p.tier
    FROM public.user_subscriptions us
    JOIN public.plans p ON p.id = us.plan_id
    WHERE us.status = 'active'
      AND us.expires_at IS NOT NULL
      AND us.expires_at < now()
      AND us.expired_notified_at IS NULL
      AND p.price_pkr > 0  -- only paid plans get downgraded
  LOOP
    -- Downgrade to the free plan in the same tier
    UPDATE public.user_subscriptions
      SET plan_id             = CASE WHEN r.tier = 'enterprise' THEN v_ent_free_id ELSE v_ind_free_id END,
          status              = 'active',
          expires_at          = NULL,
          renew_reminded_at   = NULL,
          expired_notified_at = now(),
          updated_at          = now()
      WHERE user_id = r.user_id;

    PERFORM public.create_notification(
      r.user_id,
      'Your ' || r.plan_name || ' plan has expired',
      'You have been moved to the free plan. Renew anytime to restore your ' || r.plan_name || ' features.',
      'error',
      '/billing'
    );
    v_downgraded := v_downgraded + 1;
  END LOOP;

  reminded := v_reminded;
  downgraded := v_downgraded;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_subscription_expiry() TO service_role;

-- ── Schedule via pg_cron ───────────────────────────────────
-- Enable pg_cron if not already (Supabase has it preinstalled but the
-- extension may need to be enabled).
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any prior scheduling
DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'process_subscription_expiry_daily';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

-- Schedule: every day at 02:00 UTC
SELECT cron.schedule(
  'process_subscription_expiry_daily',
  '0 2 * * *',
  $$SELECT public.process_subscription_expiry();$$
);
