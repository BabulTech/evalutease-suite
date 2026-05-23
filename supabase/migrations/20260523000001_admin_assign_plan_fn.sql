-- ============================================================
-- Admin RPC: assign any plan to any user.
-- Runs as SECURITY DEFINER so it bypasses RLS and can write
-- to both user_subscriptions AND profiles.selected_plan.
-- Only callable by users with the 'admin' role.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_assign_plan(
  p_user_id UUID,
  p_plan_slug TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan_id    UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Caller must be an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT id INTO v_plan_id FROM public.plans WHERE slug = p_plan_slug AND is_active = true LIMIT 1;
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plan not found: %', p_plan_slug;
  END IF;

  -- Trial plans get an expiry; all others are cleared
  IF p_plan_slug = 'enterprise_starter' THEN
    v_expires_at := now() + INTERVAL '15 days';
  END IF;

  -- Update the subscription (trigger trg_set_trial_expiry will also fire)
  INSERT INTO public.user_subscriptions (user_id, plan_id, status, expires_at)
  VALUES (p_user_id, v_plan_id, 'active', v_expires_at)
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id    = EXCLUDED.plan_id,
    status     = 'active',
    expires_at = EXCLUDED.expires_at,
    updated_at = now();

  -- Sync profiles.selected_plan so the client repair logic never fights us
  UPDATE public.profiles
  SET selected_plan = p_plan_slug,
      updated_at    = now()
  WHERE id = p_user_id;
END;
$$;

-- Only authenticated admins can execute this
GRANT EXECUTE ON FUNCTION public.admin_assign_plan(UUID, TEXT) TO authenticated;
