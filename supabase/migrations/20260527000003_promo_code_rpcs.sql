-- Create promo_codes table
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL UNIQUE,
  description           TEXT,
  discount_type         TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed', 'free')),
  discount_percent      NUMERIC,
  discount_fixed_cents  NUMERIC,
  applies_to_slugs      TEXT[] NOT NULL DEFAULT '{}',
  max_uses              INTEGER,
  uses_count            INTEGER NOT NULL DEFAULT 0,
  expires_at            TIMESTAMPTZ,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'promo_codes' AND policyname = 'Admins manage promo_codes'
  ) THEN
    CREATE POLICY "Admins manage promo_codes"
      ON public.promo_codes FOR ALL
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Validate a promo code and return its discount details
-- Returns null if invalid/expired/exhausted/not applicable
CREATE OR REPLACE FUNCTION public.validate_promo_code(p_code TEXT, p_plan_slug TEXT)
RETURNS TABLE (
  id            UUID,
  discount_type TEXT,
  discount_percent  NUMERIC,
  discount_fixed_pkr NUMERIC,
  description   TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row public.promo_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.promo_codes
  WHERE code = upper(trim(p_code))
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR uses_count < max_uses)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Check plan applicability (empty array = all plans)
  IF array_length(v_row.applies_to_slugs, 1) > 0
     AND NOT (p_plan_slug = ANY(v_row.applies_to_slugs)) THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT
    v_row.id,
    v_row.discount_type::TEXT,
    v_row.discount_percent,
    -- discount_fixed_cents stored as cents; convert to PKR (treat 1 cent = 1 PKR for PKR system)
    v_row.discount_fixed_cents::NUMERIC,
    v_row.description;
END;
$$;

-- Redeem a "free" promo code: grant the plan at no cost
CREATE OR REPLACE FUNCTION public.redeem_free_promo(p_code TEXT, p_plan_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_promo   public.promo_codes%ROWTYPE;
  v_plan    public.plans%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_promo
  FROM public.promo_codes
  WHERE code = upper(trim(p_code))
    AND is_active = true
    AND discount_type = 'free'
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR uses_count < max_uses)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired promo code';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan not found';
  END IF;

  -- Check plan applicability
  IF array_length(v_promo.applies_to_slugs, 1) > 0
     AND NOT (v_plan.slug = ANY(v_promo.applies_to_slugs)) THEN
    RAISE EXCEPTION 'Promo code not valid for this plan';
  END IF;

  -- Upsert subscription
  INSERT INTO public.user_subscriptions (user_id, plan_id, status, started_at, updated_at)
  VALUES (v_user_id, p_plan_id, 'active', now(), now())
  ON CONFLICT (user_id)
  DO UPDATE SET plan_id = p_plan_id, status = 'active', updated_at = now();

  -- Increment uses_count
  UPDATE public.promo_codes SET uses_count = uses_count + 1 WHERE id = v_promo.id;

  -- Log it
  INSERT INTO public.manual_payments (
    user_id, plan_id, amount_pkr, payment_method, status, notes, credits_to_add
  ) VALUES (
    v_user_id, p_plan_id, 0, 'other', 'approved',
    'Free via promo code: ' || v_promo.code, 0
  );

  RETURN 'ok';
END;
$$;

-- Increment uses_count when a paid promo is used (called after payment submission)
CREATE OR REPLACE FUNCTION public.record_promo_use(p_code TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.promo_codes
  SET uses_count = uses_count + 1
  WHERE code = upper(trim(p_code));
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_promo_code(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_free_promo(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_promo_use(TEXT) TO authenticated;

-- Admin: read all activity logs with actor name/email joined from profiles
CREATE OR REPLACE FUNCTION public.get_admin_activity_logs(
  p_limit       INT     DEFAULT 500,
  p_module      TEXT    DEFAULT NULL,
  p_action_type TEXT    DEFAULT NULL,
  p_search      TEXT    DEFAULT NULL,
  p_date_from   TIMESTAMPTZ DEFAULT NULL,
  p_date_to     TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id            UUID,
  actor_user_id UUID,
  actor_name    TEXT,
  actor_email   TEXT,
  action_type   TEXT,
  module        TEXT,
  entity_type   TEXT,
  entity_id     UUID,
  entity_label  TEXT,
  message       TEXT,
  details       JSONB,
  risk_score    INTEGER,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.actor_user_id,
    COALESCE(p.full_name, split_part(COALESCE(p.email, ''), '@', 1), 'Unknown') AS actor_name,
    p.email AS actor_email,
    al.action_type,
    al.module,
    al.entity_type,
    al.entity_id,
    al.entity_label,
    al.message,
    al.details,
    al.risk_score,
    al.created_at
  FROM public.activity_logs al
  LEFT JOIN public.profiles p ON p.id = al.actor_user_id
  WHERE
    (p_module      IS NULL OR al.module      = p_module)
    AND (p_action_type IS NULL OR al.action_type = p_action_type)
    AND (p_date_from   IS NULL OR al.created_at  >= p_date_from)
    AND (p_date_to     IS NULL OR al.created_at  <= p_date_to)
    AND (p_search IS NULL OR (
      p.full_name   ILIKE '%' || p_search || '%'
      OR p.email    ILIKE '%' || p_search || '%'
      OR al.message ILIKE '%' || p_search || '%'
      OR al.entity_label ILIKE '%' || p_search || '%'
    ))
  ORDER BY al.created_at DESC
  LIMIT GREATEST(1, LEAST(1000, COALESCE(p_limit, 500)));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_activity_logs(INT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
