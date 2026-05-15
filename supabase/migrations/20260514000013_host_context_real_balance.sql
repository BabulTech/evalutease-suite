-- ============================================================
-- Update get_my_host_context to also return the host's REAL
-- credit balance from user_credits. company_members.credit_limit
-- is a lifetime-allocation counter (and historically buggy due
-- to double-counting in transfer_credits_to_host).
-- user_credits.balance is the single source of truth.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_my_host_context() CASCADE;

CREATE OR REPLACE FUNCTION public.get_my_host_context()
RETURNS TABLE(
  member_id           UUID,
  member_full_name    TEXT,
  member_role         TEXT,
  member_credit_limit INT,
  member_credits_used INT,
  host_balance        INT,
  host_total_earned   INT,
  host_total_spent    INT,
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
    COALESCE(uc.balance, 0)::INT,
    COALESCE(uc.total_earned, 0)::INT,
    COALESCE(uc.total_spent, 0)::INT,
    cm.company_id,
    cp.company_name,
    cp.admin_user_id,
    p.full_name,
    p.email,
    pl.name,
    pl.slug::TEXT
  FROM public.company_members cm
  LEFT JOIN public.user_credits      uc  ON uc.user_id = cm.user_id
  LEFT JOIN public.company_profiles  cp  ON cp.id      = cm.company_id
  LEFT JOIN public.profiles          p   ON p.id       = cp.admin_user_id
  LEFT JOIN public.user_subscriptions us ON us.user_id = cp.admin_user_id AND us.status = 'active'
  LEFT JOIN public.plans             pl  ON pl.id      = us.plan_id
  WHERE cm.user_id = auth.uid()
    AND cm.status  = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_host_context() TO authenticated, anon;
