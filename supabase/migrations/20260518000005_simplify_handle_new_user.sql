-- ============================================================
-- Final handle_new_user trigger
-- Each sub-INSERT wrapped in BEGIN/EXCEPTION so a single failure
-- (e.g. RLS, missing column) doesn't break the entire signup.
-- Outer EXCEPTION ensures signup always succeeds even if all
-- inserts fail. The subscription INSERT uses ON CONFLICT DO UPDATE
-- to overwrite any wrong plan assigned by other triggers.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_selected_plan TEXT;
  v_plan_id       UUID;
  v_expires_at    TIMESTAMPTZ;
BEGIN
  v_selected_plan := COALESCE(NEW.raw_user_meta_data->>'selected_plan', 'individual_starter');
  IF v_selected_plan NOT IN ('individual_starter', 'enterprise_starter') THEN
    v_selected_plan := 'individual_starter';
  END IF;

  SELECT id INTO v_plan_id FROM public.plans WHERE slug = v_selected_plan LIMIT 1;
  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM public.plans WHERE slug = 'individual_starter' LIMIT 1;
  END IF;

  IF v_selected_plan = 'enterprise_starter' THEN
    v_expires_at := now() + INTERVAL '15 days';
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher')
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    INSERT INTO public.user_credits (user_id, balance, total_earned, total_spent)
    VALUES (NEW.id, 0, 0, 0)
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status, expires_at)
    VALUES (NEW.id, v_plan_id, 'active', v_expires_at)
    ON CONFLICT (user_id) DO UPDATE SET
      plan_id    = EXCLUDED.plan_id,
      status     = 'active',
      expires_at = EXCLUDED.expires_at,
      updated_at = now();
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  IF v_selected_plan = 'enterprise_starter' THEN
    BEGIN
      INSERT INTO public.trial_ai_usage (user_id, used_calls, trial_start, trial_end)
      VALUES (NEW.id, 0, now(), now() + INTERVAL '15 days')
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
