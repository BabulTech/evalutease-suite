-- Allows inserting a manual_payment row even before email confirmation
-- (no active session = auth.uid() is null, so user RLS blocks the insert).
-- Called from signup.tsx with the user_id returned by supabase.auth.signUp().

CREATE OR REPLACE FUNCTION public.submit_payment_on_signup(
  p_user_id      UUID,
  p_plan_slug    TEXT,
  p_method       TEXT DEFAULT 'other',
  p_screenshot   TEXT DEFAULT NULL,
  p_notes        TEXT DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan_id   UUID;
  v_price     NUMERIC;
  v_credits   INT;
BEGIN
  -- Resolve plan details
  SELECT id, price_pkr, COALESCE(credits_per_month, 0)
    INTO v_plan_id, v_price, v_credits
  FROM public.plans
  WHERE slug = p_plan_slug::public.plan_slug
  LIMIT 1;

  INSERT INTO public.manual_payments (
    user_id, plan_id, amount_pkr, payment_method,
    screenshot_url, status, credits_to_add, notes
  ) VALUES (
    p_user_id, v_plan_id, COALESCE(v_price, 0)::INTEGER,
    p_method::public.payment_method,
    COALESCE(p_screenshot, ''),
    'pending'::public.payment_status,
    COALESCE(v_credits, 0), p_notes
  );
END;
$$;

-- Allow unauthenticated (anon) and authenticated callers
GRANT EXECUTE ON FUNCTION public.submit_payment_on_signup(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Allow anon uploads to payment-screenshots folder (for pre-confirmation signups)
-- Storage policies live in the storage schema
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anon upload payment screenshots" ON storage.objects;
CREATE POLICY "Anon upload payment screenshots" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'uploads' AND name LIKE 'payment-screenshots/%');
