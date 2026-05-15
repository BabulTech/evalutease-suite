-- SECURITY DEFINER function so hosts can read their company + admin info
-- bypasses RLS on company_profiles and profiles
CREATE OR REPLACE FUNCTION public.get_my_host_context()
RETURNS TABLE(
  member_id        UUID,
  member_full_name TEXT,
  member_role      TEXT,
  credit_limit     INT,
  credits_used     INT,
  company_id       UUID,
  company_name     TEXT,
  admin_user_id    UUID,
  admin_name       TEXT,
  admin_email      TEXT,
  org_plan_name    TEXT,
  org_plan_slug    TEXT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_member public.company_members%ROWTYPE;
BEGIN
  SELECT * INTO v_member
  FROM public.company_members
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  IF v_member.id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    v_member.id,
    v_member.full_name,
    COALESCE(v_member.role, 'host'),
    v_member.credit_limit,
    v_member.credits_used,
    v_member.company_id,
    cp.company_name,
    cp.admin_user_id,
    p.full_name,
    p.email,
    pl.name,
    pl.slug::TEXT
  FROM public.company_profiles cp
  LEFT JOIN public.profiles p ON p.id = cp.admin_user_id
  LEFT JOIN public.user_subscriptions us
    ON us.user_id = cp.admin_user_id AND us.status = 'active'
  LEFT JOIN public.plans pl ON pl.id = us.plan_id
  WHERE cp.id = v_member.company_id;
END;
$$;
