-- Add billing_cycle parameter to signup payment RPC so the admin's
-- approve_payment flow sees yearly vs monthly and grants the right
-- credit/expiry treatment.

DROP FUNCTION IF EXISTS public.submit_payment_on_signup(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.submit_payment_on_signup(
  p_user_id         UUID,
  p_plan_slug       TEXT,
  p_method          TEXT DEFAULT 'other',
  p_screenshot      TEXT DEFAULT NULL,
  p_notes           TEXT DEFAULT NULL,
  p_ngo_certificate TEXT DEFAULT NULL,
  p_is_ngo          BOOLEAN DEFAULT FALSE,
  p_billing_cycle   TEXT DEFAULT 'monthly'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan_id   UUID;
  v_price     NUMERIC;
  v_credits   INT;
  v_amount    INTEGER;
  v_cycle     TEXT;
  v_yearly_discount NUMERIC := 10;
BEGIN
  v_cycle := CASE WHEN p_billing_cycle = 'yearly' THEN 'yearly' ELSE 'monthly' END;

  SELECT id, price_pkr, COALESCE(credits_per_month, 0)
    INTO v_plan_id, v_price, v_credits
  FROM public.plans
  WHERE slug = p_plan_slug::public.plan_slug
  LIMIT 1;

  -- Pull yearly discount from app_settings (defaults 10% if row missing)
  BEGIN
    SELECT yearly_discount_percent INTO v_yearly_discount
    FROM public.app_settings WHERE id = TRUE LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_yearly_discount := 10;
  END;

  -- NGO discount (50% off monthly), then yearly discount applies on top
  v_amount := CASE
    WHEN v_cycle = 'yearly' AND p_is_ngo THEN
      FLOOR(COALESCE(v_price, 0) / 2 * 12 * (1 - COALESCE(v_yearly_discount, 0) / 100))::INTEGER
    WHEN v_cycle = 'yearly' THEN
      FLOOR(COALESCE(v_price, 0) * 12 * (1 - COALESCE(v_yearly_discount, 0) / 100))::INTEGER
    WHEN p_is_ngo THEN
      FLOOR(COALESCE(v_price, 0) / 2)::INTEGER
    ELSE
      COALESCE(v_price, 0)::INTEGER
  END;

  INSERT INTO public.manual_payments (
    user_id, plan_id, amount_pkr, payment_method,
    screenshot_url, ngo_certificate_url,
    status, credits_to_add, notes, billing_cycle
  ) VALUES (
    p_user_id, v_plan_id, v_amount,
    p_method::public.payment_method,
    COALESCE(p_screenshot, ''),
    p_ngo_certificate,
    'pending'::public.payment_status,
    COALESCE(v_credits, 0), p_notes,
    v_cycle
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_payment_on_signup(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
