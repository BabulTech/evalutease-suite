-- ============================================================
-- Fallback RPC: client calls this right after signup to ensure
-- the selected plan is actually assigned. Works around silent
-- trigger failures (RLS, conflicting BEFORE triggers, etc).
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_my_plan(p_plan_slug TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_plan_id    UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;
  IF p_plan_slug NOT IN ('individual_starter', 'enterprise_starter') THEN
    p_plan_slug := 'individual_starter';
  END IF;

  SELECT id INTO v_plan_id FROM public.plans WHERE slug = p_plan_slug LIMIT 1;
  IF v_plan_id IS NULL THEN RETURN; END IF;

  UPDATE public.profiles
  SET selected_plan = p_plan_slug,
      updated_at = now()
  WHERE id = v_user_id;

  IF p_plan_slug = 'enterprise_starter' THEN
    v_expires_at := now() + INTERVAL '15 days';
  END IF;

  INSERT INTO public.user_subscriptions (user_id, plan_id, status, expires_at)
  VALUES (v_user_id, v_plan_id, 'active', v_expires_at)
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id    = EXCLUDED.plan_id,
    status     = 'active',
    expires_at = EXCLUDED.expires_at,
    updated_at = now();

  IF p_plan_slug = 'enterprise_starter' THEN
    INSERT INTO public.trial_ai_usage (user_id, used_calls, trial_start, trial_end)
    VALUES (v_user_id, 0, now(), now() + INTERVAL '15 days')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_plan(TEXT) TO authenticated;
