-- ============================================================
-- NUCLEAR CLEANUP: Drop all old plan-assignment triggers/functions
-- that were overwriting handle_new_user, and rebuild ONE clean
-- trigger that respects selected_plan from signup metadata.
-- ============================================================

-- 1. Drop ALL old triggers on auth.users
DROP TRIGGER IF EXISTS on_new_user_assign_free_plan ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_plan ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Drop ALL old plan-assignment functions
DROP FUNCTION IF EXISTS public.assign_free_plan() CASCADE;
DROP FUNCTION IF EXISTS public.assign_starter_plan() CASCADE;
DROP FUNCTION IF EXISTS public.auto_assign_free_plan() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 3. Rebuild a single clean handle_new_user
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
    INSERT INTO public.profiles (id, email, full_name, selected_plan)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      v_selected_plan
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name     = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      selected_plan = EXCLUDED.selected_plan,
      updated_at    = now();
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher')
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    INSERT INTO public.user_credits (user_id, balance, total_earned, total_spent)
    VALUES (NEW.id, 0, 0, 0) ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status, expires_at)
    VALUES (NEW.id, v_plan_id, 'active', v_expires_at)
    ON CONFLICT (user_id) DO UPDATE SET
      plan_id = EXCLUDED.plan_id, status = 'active',
      expires_at = EXCLUDED.expires_at, updated_at = now();
  EXCEPTION WHEN OTHERS THEN NULL; END;

  IF v_selected_plan = 'enterprise_starter' THEN
    BEGIN
      INSERT INTO public.trial_ai_usage (user_id, used_calls, trial_start, trial_end)
      VALUES (NEW.id, 0, now(), now() + INTERVAL '15 days') ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

-- 4. Create ONLY ONE trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
