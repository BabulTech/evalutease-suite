-- ============================================================
-- Fix: handle_new_user now creates subscription based on
-- selected_plan from signup metadata.
-- Default: individual_starter (free)
-- If selected_plan = 'enterprise_starter': Enterprise Trial
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_selected_plan TEXT;
  v_plan_id       UUID;
  v_expires_at    TIMESTAMPTZ;
BEGIN
  -- 1) Upsert profile
  INSERT INTO public.profiles (
    id, email, full_name,
    role, use_cases, referral, selected_plan,
    school, grade_year, field_of_study,
    institution, subject_taught, years_exp,
    company_name, industry, team_size, other_details
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'role',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(NEW.raw_user_meta_data->'use_cases', '[]'::jsonb))),
    NEW.raw_user_meta_data->>'referral',
    NEW.raw_user_meta_data->>'selected_plan',
    NEW.raw_user_meta_data->>'school',
    NEW.raw_user_meta_data->>'grade_year',
    NEW.raw_user_meta_data->>'field_of_study',
    NEW.raw_user_meta_data->>'institution',
    NEW.raw_user_meta_data->>'subject_taught',
    NEW.raw_user_meta_data->>'years_exp',
    NEW.raw_user_meta_data->>'company_name',
    NEW.raw_user_meta_data->>'industry',
    NEW.raw_user_meta_data->>'team_size',
    NEW.raw_user_meta_data->>'other_details'
  )
  ON CONFLICT (id) DO UPDATE SET
    email        = EXCLUDED.email,
    full_name    = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    selected_plan = COALESCE(EXCLUDED.selected_plan, public.profiles.selected_plan),
    updated_at   = now();

  -- 2) Assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'teacher')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 3) Create credits row
  INSERT INTO public.user_credits (user_id, balance, total_earned, total_spent)
  VALUES (NEW.id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- 4) Determine plan from signup metadata
  v_selected_plan := COALESCE(NEW.raw_user_meta_data->>'selected_plan', 'individual_starter');

  -- Only allow valid assignable plans at signup
  IF v_selected_plan NOT IN ('individual_starter', 'enterprise_starter') THEN
    v_selected_plan := 'individual_starter';
  END IF;

  SELECT id INTO v_plan_id FROM public.plans WHERE slug = v_selected_plan LIMIT 1;

  -- Fallback to individual_starter if plan not found
  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id FROM public.plans WHERE slug = 'individual_starter' LIMIT 1;
  END IF;

  -- Set expires_at for enterprise trial (15 days)
  IF v_selected_plan = 'enterprise_starter' THEN
    v_expires_at := now() + INTERVAL '15 days';
  ELSE
    v_expires_at := NULL;
  END IF;

  -- 5) Create or UPDATE subscription (force correct plan)
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status, expires_at)
    VALUES (NEW.id, v_plan_id, 'active', v_expires_at)
    ON CONFLICT (user_id) DO UPDATE SET
      plan_id    = EXCLUDED.plan_id,
      status     = 'active',
      expires_at = EXCLUDED.expires_at,
      updated_at = now();
  END IF;

  -- 6) Create trial usage row for enterprise trial
  IF v_selected_plan = 'enterprise_starter' THEN
    INSERT INTO public.trial_ai_usage (user_id, used_calls, trial_start, trial_end)
    VALUES (NEW.id, 0, now(), now() + INTERVAL '15 days')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
