-- ============================================================
-- FIX 1: Rewrite get_my_host_context as plain SQL.
-- The old plpgsql version had a name conflict: the OUT parameters
-- (credit_limit, credits_used) shadowed the actual table columns,
-- causing PostgREST to fail with 400 Bad Request.
-- A pure-SQL function has no variable scope, so no conflict.
-- ============================================================
DROP FUNCTION IF EXISTS public.get_my_host_context();

CREATE OR REPLACE FUNCTION public.get_my_host_context()
RETURNS TABLE(
  member_id          UUID,
  member_full_name   TEXT,
  member_role        TEXT,
  member_credit_limit INT,
  member_credits_used INT,
  org_company_id     UUID,
  company_name       TEXT,
  admin_user_id      UUID,
  admin_name         TEXT,
  admin_email        TEXT,
  org_plan_name      TEXT,
  org_plan_slug      TEXT
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
  LEFT JOIN public.company_profiles cp  ON cp.id = cm.company_id
  LEFT JOIN public.profiles p          ON p.id  = cp.admin_user_id
  LEFT JOIN public.user_subscriptions us ON us.user_id = cp.admin_user_id AND us.status = 'active'
  LEFT JOIN public.plans pl            ON pl.id = us.plan_id
  WHERE cm.user_id = auth.uid()
    AND cm.status  = 'active'
  LIMIT 1;
$$;

-- ============================================================
-- FIX 2: Backfill missing public.profiles rows for any auth user
-- that signed up while handle_new_user was failing silently.
-- ============================================================
INSERT INTO public.profiles (id, email, full_name)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  )
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Also ensure user_roles row exists for these users (default: teacher)
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'teacher'
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;
