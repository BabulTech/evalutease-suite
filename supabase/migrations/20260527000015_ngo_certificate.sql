-- Add NGO certificate to manual_payments so admins can verify NGO discount claims
-- alongside the payment screenshot in the Finance section.

ALTER TABLE public.manual_payments
  ADD COLUMN IF NOT EXISTS ngo_certificate_url TEXT;

-- Update submit_payment_on_signup to accept NGO certificate path + apply 50% NGO discount
CREATE OR REPLACE FUNCTION public.submit_payment_on_signup(
  p_user_id        UUID,
  p_plan_slug      TEXT,
  p_method         TEXT DEFAULT 'other',
  p_screenshot     TEXT DEFAULT NULL,
  p_notes          TEXT DEFAULT NULL,
  p_ngo_certificate TEXT DEFAULT NULL,
  p_is_ngo         BOOLEAN DEFAULT FALSE
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan_id   UUID;
  v_price     NUMERIC;
  v_credits   INT;
  v_amount    INTEGER;
BEGIN
  SELECT id, price_pkr, COALESCE(credits_per_month, 0)
    INTO v_plan_id, v_price, v_credits
  FROM public.plans
  WHERE slug = p_plan_slug::public.plan_slug
  LIMIT 1;

  -- Apply 50% NGO discount (rounded down) when NGO certificate provided
  v_amount := CASE
    WHEN p_is_ngo THEN FLOOR(COALESCE(v_price, 0) / 2)::INTEGER
    ELSE COALESCE(v_price, 0)::INTEGER
  END;

  INSERT INTO public.manual_payments (
    user_id, plan_id, amount_pkr, payment_method,
    screenshot_url, ngo_certificate_url,
    status, credits_to_add, notes
  ) VALUES (
    p_user_id, v_plan_id, v_amount,
    p_method::public.payment_method,
    COALESCE(p_screenshot, ''),
    p_ngo_certificate,
    'pending'::public.payment_status,
    COALESCE(v_credits, 0), p_notes
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_payment_on_signup(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated;
