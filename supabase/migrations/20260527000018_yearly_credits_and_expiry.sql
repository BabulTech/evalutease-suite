-- ============================================================
-- Yearly billing: prepaid 12-month model (Option A)
--
-- When a yearly payment is approved:
--   * grant 12 × credits_per_month in one batch
--   * set user_subscriptions.expires_at = now() + 1 year
--
-- When a monthly payment is approved:
--   * grant 1 × credits_per_month
--   * set expires_at = now() + 1 month
--
-- Credits are prepaid; no monthly drip / cron needed.
-- ============================================================

CREATE OR REPLACE FUNCTION public.approve_payment(
  p_payment_id  UUID,
  p_admin_id    UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment        public.manual_payments;
  v_monthly_credits INTEGER;
  v_credits        INTEGER;
  v_cycle          TEXT;
  v_expires_at     TIMESTAMPTZ;
BEGIN
  -- SECURITY: only admins may approve payments.
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized: admin role required';
  END IF;
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'unauthorized: p_admin_id must equal calling user';
  END IF;

  SELECT * INTO v_payment FROM public.manual_payments WHERE id = p_payment_id FOR UPDATE;
  IF v_payment IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_payment.status <> 'pending' THEN RAISE EXCEPTION 'Payment already processed'; END IF;

  -- Resolve billing cycle (defaults to monthly if column missing/null)
  v_cycle := COALESCE(v_payment.billing_cycle, 'monthly');

  -- Recompute credits server-side from the plan
  IF v_payment.plan_id IS NOT NULL THEN
    SELECT credits_per_month INTO v_monthly_credits
    FROM public.plans WHERE id = v_payment.plan_id;
    v_monthly_credits := COALESCE(v_monthly_credits, 0);
  ELSE
    v_monthly_credits := GREATEST(v_payment.credits_to_add, 0);
  END IF;

  -- Yearly = 12× credits prepaid + 1-year expiry
  -- Monthly = 1× credits + 1-month expiry
  IF v_cycle = 'yearly' THEN
    v_credits := v_monthly_credits * 12;
    v_expires_at := now() + INTERVAL '1 year';
  ELSE
    v_credits := v_monthly_credits;
    v_expires_at := now() + INTERVAL '1 month';
  END IF;

  IF v_credits > 0 THEN
    PERFORM public.add_credits(
      v_payment.user_id, v_credits,
      'payment_approved',
      'Payment approved: ' || v_payment.amount_pkr || ' PKR (' || v_cycle || ')',
      p_payment_id, p_admin_id
    );
  END IF;

  IF v_payment.plan_id IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status, expires_at, assigned_by)
      VALUES (v_payment.user_id, v_payment.plan_id, 'active', v_expires_at, p_admin_id)
      ON CONFLICT (user_id) DO UPDATE
        SET plan_id     = v_payment.plan_id,
            status      = 'active',
            expires_at  = v_expires_at,
            assigned_by = p_admin_id,
            updated_at  = now();
  END IF;

  UPDATE public.manual_payments
    SET status         = 'approved',
        credits_to_add = v_credits,
        reviewed_by    = p_admin_id,
        reviewed_at    = now(),
        admin_notes    = p_admin_notes,
        updated_at     = now()
  WHERE id = p_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_payment(UUID, UUID, TEXT) TO authenticated;
