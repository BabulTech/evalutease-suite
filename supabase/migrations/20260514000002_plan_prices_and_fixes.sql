-- Fix AI scan cost (was 1, actual Anthropic cost ~$0.008 = ~PKR 2.2, minimum 2 credits)
UPDATE public.plans SET credit_cost_ai_scan = 2;

-- Set default plan prices (PKR)
UPDATE public.plans SET price_pkr = 0     WHERE slug = 'individual_starter';
UPDATE public.plans SET price_pkr = 999   WHERE slug = 'individual_pro';
UPDATE public.plans SET price_pkr = 1999  WHERE slug = 'individual_pro_plus';
UPDATE public.plans SET price_pkr = 3999  WHERE slug = 'enterprise_starter';
UPDATE public.plans SET price_pkr = 7999  WHERE slug = 'enterprise_pro';
UPDATE public.plans SET price_pkr = 14999 WHERE slug = 'enterprise_elite';

-- Set credits per month per plan
UPDATE public.plans SET credits_per_month = 0    WHERE slug = 'individual_starter';
UPDATE public.plans SET credits_per_month = 200  WHERE slug = 'individual_pro';
UPDATE public.plans SET credits_per_month = 600  WHERE slug = 'individual_pro_plus';
UPDATE public.plans SET credits_per_month = 1000 WHERE slug = 'enterprise_starter';
UPDATE public.plans SET credits_per_month = 3000 WHERE slug = 'enterprise_pro';
UPDATE public.plans SET credits_per_month = 9999 WHERE slug = 'enterprise_elite';

-- Enable AI for paid plans, disable for free starters
UPDATE public.plans SET ai_enabled = false WHERE slug IN ('individual_starter', 'enterprise_starter');
UPDATE public.plans SET ai_enabled = true  WHERE slug NOT IN ('individual_starter', 'enterprise_starter');

-- Ensure expires_at column exists
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Update approve_payment to set expires_at = now() + 30 days on plan assignment
CREATE OR REPLACE FUNCTION public.approve_payment(
  p_payment_id UUID,
  p_admin_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment public.manual_payments;
BEGIN
  SELECT * INTO v_payment FROM public.manual_payments WHERE id = p_payment_id;
  IF v_payment IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_payment.status != 'pending' THEN RAISE EXCEPTION 'Payment already processed'; END IF;

  -- Add credits
  PERFORM public.add_credits(
    v_payment.user_id, v_payment.credits_to_add,
    'payment_approved', 'Payment approved: ' || v_payment.amount_pkr || ' PKR',
    p_payment_id, p_admin_id
  );

  -- Update plan subscription with 30-day expiry
  IF v_payment.plan_id IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status, started_at, expires_at, assigned_by)
      VALUES (v_payment.user_id, v_payment.plan_id, 'active', now(), now() + INTERVAL '30 days', p_admin_id)
      ON CONFLICT (user_id) DO UPDATE
      SET plan_id    = v_payment.plan_id,
          status     = 'active',
          started_at = now(),
          expires_at = now() + INTERVAL '30 days',
          assigned_by = p_admin_id,
          updated_at = now();
  END IF;

  -- Mark payment approved
  UPDATE public.manual_payments
    SET status = 'approved', reviewed_by = p_admin_id,
        reviewed_at = now(), admin_notes = p_admin_notes, updated_at = now()
    WHERE id = p_payment_id;
END;
$$;

-- Index for fast expiry checks
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires_at
  ON public.user_subscriptions(expires_at)
  WHERE expires_at IS NOT NULL;
