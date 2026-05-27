-- Rewrite handle_new_user so profile creation is isolated in its own
-- exception block and can NEVER be skipped by a failure in later steps.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_selected_plan TEXT;
  v_plan_id       UUID;
  v_full_name     TEXT;
BEGIN
  -- ── Step 1: Profile (isolated — must always succeed) ────────
  BEGIN
    v_full_name := COALESCE(
      NULLIF(TRIM(
        COALESCE(NEW.raw_user_meta_data->>'first_name','') || ' ' ||
        COALESCE(NEW.raw_user_meta_data->>'last_name','')
      ), ''),
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      SPLIT_PART(NEW.email, '@', 1)
    );

    INSERT INTO public.profiles (id, email, full_name, selected_plan, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      v_full_name,
      COALESCE(NEW.raw_user_meta_data->>'selected_plan', 'individual_starter'),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      email         = EXCLUDED.email,
      full_name     = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      selected_plan = COALESCE(EXCLUDED.selected_plan, public.profiles.selected_plan),
      updated_at    = now();
  EXCEPTION WHEN OTHERS THEN
    NULL; -- profile creation must never block signup
  END;

  -- ── Step 2: Role ─────────────────────────────────────────────
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'teacher')
    ON CONFLICT (user_id, role) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ── Step 3: Credits row ───────────────────────────────────────
  BEGIN
    INSERT INTO public.user_credits (user_id, balance, total_earned, total_spent)
    VALUES (NEW.id, 0, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- ── Step 4: Subscription ─────────────────────────────────────
  BEGIN
    v_selected_plan := COALESCE(NEW.raw_user_meta_data->>'selected_plan', 'individual_starter');

    -- Only allow free plans at signup; paid plans require manual payment approval
    IF v_selected_plan NOT IN ('individual_starter', 'enterprise_free') THEN
      v_selected_plan := 'individual_starter';
    END IF;

    SELECT id INTO v_plan_id FROM public.plans WHERE slug = v_selected_plan::public.plan_slug LIMIT 1;

    IF v_plan_id IS NULL THEN
      SELECT id INTO v_plan_id FROM public.plans WHERE slug = 'individual_starter'::public.plan_slug LIMIT 1;
    END IF;

    IF v_plan_id IS NOT NULL THEN
      INSERT INTO public.user_subscriptions (user_id, plan_id, status, expires_at)
      VALUES (NEW.id, v_plan_id, 'active', NULL)
      ON CONFLICT (user_id) DO UPDATE SET
        plan_id    = EXCLUDED.plan_id,
        status     = 'active',
        expires_at = NULL,
        updated_at = now();
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END;
$$;
