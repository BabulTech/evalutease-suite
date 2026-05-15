-- ============================================================
-- COMBINED HOST FIX — run this entire block in Supabase SQL editor.
-- Idempotent: safe to re-run.
-- ============================================================

-- ─── Step 1 ─────────────────────────────────────────────
-- Patch every signup-side trigger to be safe BEFORE we attempt
-- any profile/user_roles inserts. If we backfill first, these
-- triggers fire and any reference to the old 'free' slug (or
-- any other stale state) rolls back the whole transaction.
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.assign_free_plan()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan_id UUID;
BEGIN
  SELECT id INTO v_plan_id FROM public.plans WHERE slug = 'individual_starter' LIMIT 1;
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status)
    VALUES (NEW.id, v_plan_id, 'active') ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.user_credits (user_id, balance)
    VALUES (NEW.id, 0) ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_starter_plan()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan_id UUID;
BEGIN
  SELECT id INTO v_plan_id FROM public.plans WHERE slug = 'individual_starter' LIMIT 1;
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status)
    VALUES (NEW.id, v_plan_id, 'active') ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.user_credits (user_id, balance)
    VALUES (NEW.id, 0) ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_assign_free_plan()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'teacher')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

-- ─── Step 2 ─────────────────────────────────────────────
-- Drop the old plpgsql get_my_host_context with the variable
-- conflict and replace with a pure SQL version.
-- ──────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.get_my_host_context() CASCADE;

CREATE OR REPLACE FUNCTION public.get_my_host_context()
RETURNS TABLE(
  member_id           UUID,
  member_full_name    TEXT,
  member_role         TEXT,
  member_credit_limit INT,
  member_credits_used INT,
  org_company_id      UUID,
  company_name        TEXT,
  admin_user_id       UUID,
  admin_name          TEXT,
  admin_email         TEXT,
  org_plan_name       TEXT,
  org_plan_slug       TEXT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    cm.id,
    cm.full_name,
    COALESCE(cm.role, 'host'),
    cm.credit_limit,
    cm.credits_used,
    cm.company_id,
    cp.company_name,
    cp.admin_user_id,
    p.full_name,
    p.email,
    pl.name,
    pl.slug::TEXT
  FROM public.company_members cm
  LEFT JOIN public.company_profiles  cp  ON cp.id      = cm.company_id
  LEFT JOIN public.profiles          p   ON p.id       = cp.admin_user_id
  LEFT JOIN public.user_subscriptions us  ON us.user_id = cp.admin_user_id AND us.status = 'active'
  LEFT JOIN public.plans             pl  ON pl.id      = us.plan_id
  WHERE cm.user_id = auth.uid()
    AND cm.status  = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_host_context() TO authenticated, anon;

-- ─── Step 3 ─────────────────────────────────────────────
-- Now triggers are safe, run backfill.
-- ──────────────────────────────────────────────────────────

INSERT INTO public.profiles (id, email, full_name)
SELECT
  u.id, u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1))
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'teacher'
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Link any company_members rows that match an auth.user by email
UPDATE public.company_members cm
   SET user_id = u.id, status = 'active', updated_at = now()
  FROM auth.users u
 WHERE lower(u.email) = lower(cm.invited_email)
   AND (cm.user_id IS NULL OR cm.status <> 'active');
