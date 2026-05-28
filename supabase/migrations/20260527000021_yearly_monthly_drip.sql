-- ============================================================
-- Yearly billing: monthly credit drip (replaces all-at-once model)
--
-- On approval (yearly):
--   * grant 1 month of credits immediately
--   * set expires_at = now() + 1 year
--   * set last_credit_grant_at = now()
--   * set billing_cycle = 'yearly' on the subscription
--
-- On approval (monthly):
--   * grant 1 month of credits
--   * set expires_at = now() + 1 month
--
-- Daily cron tops up 1 month of credits for each yearly subscription
-- whose last_credit_grant_at < now() - 1 month AND expires_at > now().
-- ============================================================

-- ── Schema: track cycle + last grant ────────────────────────
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly','yearly')),
  ADD COLUMN IF NOT EXISTS last_credit_grant_at TIMESTAMPTZ;

-- ── approve_payment: drip model ────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_payment(
  p_payment_id  UUID,
  p_admin_id    UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment         public.manual_payments;
  v_monthly_credits INTEGER;
  v_cycle           TEXT;
  v_expires_at      TIMESTAMPTZ;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized: admin role required';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'unauthorized: p_admin_id must equal calling user';
  END IF;

  SELECT * INTO v_payment FROM public.manual_payments WHERE id = p_payment_id FOR UPDATE;
  IF v_payment IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_payment.status <> 'pending' THEN RAISE EXCEPTION 'Payment already processed'; END IF;

  v_cycle := COALESCE(v_payment.billing_cycle, 'monthly');

  -- Server-recomputed credits from plan
  IF v_payment.plan_id IS NOT NULL THEN
    SELECT credits_per_month INTO v_monthly_credits
    FROM public.plans WHERE id = v_payment.plan_id;
    v_monthly_credits := COALESCE(v_monthly_credits, 0);
  ELSE
    v_monthly_credits := GREATEST(v_payment.credits_to_add, 0);
  END IF;

  -- Expiry: yearly = 1 year, monthly = 1 month
  v_expires_at := CASE
    WHEN v_cycle = 'yearly' THEN now() + INTERVAL '1 year'
    ELSE now() + INTERVAL '1 month'
  END;

  -- Grant FIRST month of credits (same for yearly & monthly)
  IF v_monthly_credits > 0 THEN
    PERFORM public.add_credits(
      v_payment.user_id, v_monthly_credits,
      'payment_approved',
      'Payment approved: ' || v_payment.amount_pkr || ' PKR (' || v_cycle || ', month 1)',
      p_payment_id, p_admin_id
    );
  END IF;

  IF v_payment.plan_id IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (
      user_id, plan_id, status, expires_at, billing_cycle,
      last_credit_grant_at, assigned_by
    )
    VALUES (
      v_payment.user_id, v_payment.plan_id, 'active', v_expires_at, v_cycle,
      now(), p_admin_id
    )
    ON CONFLICT (user_id) DO UPDATE
      SET plan_id              = v_payment.plan_id,
          status               = 'active',
          expires_at           = v_expires_at,
          billing_cycle        = v_cycle,
          last_credit_grant_at = now(),
          renew_reminded_at    = NULL,
          expired_notified_at  = NULL,
          assigned_by          = p_admin_id,
          updated_at           = now();
  END IF;

  UPDATE public.manual_payments
    SET status         = 'approved',
        credits_to_add = v_monthly_credits,  -- record what was granted on approval
        reviewed_by    = p_admin_id,
        reviewed_at    = now(),
        admin_notes    = p_admin_notes,
        updated_at     = now()
  WHERE id = p_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_payment(UUID, UUID, TEXT) TO authenticated;

-- ── Monthly drip cron job ──────────────────────────────────
-- For yearly subscriptions still within their year, top up 1 month
-- of credits each calendar month (more than ~30 days since last grant).
CREATE OR REPLACE FUNCTION public.drip_yearly_credits()
RETURNS TABLE (granted BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_granted BIGINT := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT us.user_id,
           us.expires_at,
           p.id   AS plan_id,
           p.name AS plan_name,
           COALESCE(p.credits_per_month, 0) AS credits_per_month
    FROM public.user_subscriptions us
    JOIN public.plans p ON p.id = us.plan_id
    WHERE us.status = 'active'
      AND us.billing_cycle = 'yearly'
      AND us.expires_at IS NOT NULL
      AND us.expires_at > now()
      AND p.price_pkr > 0
      AND (us.last_credit_grant_at IS NULL
           OR us.last_credit_grant_at <= now() - INTERVAL '1 month')
      -- Don't grant a top-up in the LAST month of the year — that month was
      -- already paid for in month-1's grant. (i.e. last grant happens when
      -- there's > 1 month left to expiry.)
      AND us.expires_at > now() + INTERVAL '1 month'
  LOOP
    IF r.credits_per_month > 0 THEN
      PERFORM public.add_credits(
        r.user_id, r.credits_per_month,
        'monthly_drip',
        'Monthly credits for yearly ' || r.plan_name,
        NULL, NULL
      );
    END IF;

    UPDATE public.user_subscriptions
      SET last_credit_grant_at = now(),
          updated_at           = now()
      WHERE user_id = r.user_id;

    v_granted := v_granted + 1;
  END LOOP;

  granted := v_granted;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.drip_yearly_credits() TO service_role;

-- The credit_tx_type enum may need a 'monthly_drip' value. Add if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.credit_tx_type'::regtype
      AND enumlabel = 'monthly_drip'
  ) THEN
    ALTER TYPE public.credit_tx_type ADD VALUE 'monthly_drip';
  END IF;
END $$;

-- ── Schedule via pg_cron — daily at 02:30 UTC ──────────────
DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'drip_yearly_credits_daily';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'drip_yearly_credits_daily',
  '30 2 * * *',
  $$SELECT public.drip_yearly_credits();$$
);
