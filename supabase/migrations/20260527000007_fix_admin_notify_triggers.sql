-- Fix admin notification triggers that were blocking auth.users INSERT.
-- Both functions now have EXCEPTION WHEN OTHERS THEN RETURN NEW so they
-- can NEVER prevent a user from being created, regardless of any error.

CREATE OR REPLACE FUNCTION public.notify_admins(
  p_title TEXT,
  p_body  TEXT DEFAULT NULL,
  p_type  TEXT DEFAULT 'info',
  p_link  TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  FOR v_admin_id IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    PERFORM public.create_notification(v_admin_id, p_title, p_body, p_type, p_link);
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  NULL; -- never raise
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_admins(TEXT, TEXT, TEXT, TEXT) TO service_role, authenticated;

-- ── New-user trigger (safe) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.on_new_user_notify_admins()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email TEXT;
  v_name  TEXT;
BEGIN
  v_email := COALESCE(NEW.email, '');
  v_name  := COALESCE(
    NULLIF(TRIM(
      COALESCE(NEW.raw_user_meta_data->>'first_name','') || ' ' ||
      COALESCE(NEW.raw_user_meta_data->>'last_name','')
    ), ''),
    NEW.raw_user_meta_data->>'full_name',
    v_email
  );
  PERFORM public.notify_admins(
    'New user registered',
    v_name || ' (' || v_email || ') just created an account.',
    'info',
    '/admin?section=users'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;  -- NEVER block signup
END;
$$;

DROP TRIGGER IF EXISTS on_new_user_notify_admins ON auth.users;
CREATE TRIGGER on_new_user_notify_admins
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.on_new_user_notify_admins();

-- ── Payment-submitted trigger (safe) ─────────────────────────
CREATE OR REPLACE FUNCTION public.on_payment_submitted_notify_admins()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email     TEXT;
  v_plan_name TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.user_id;
  SELECT name  INTO v_plan_name FROM public.plans WHERE id = NEW.plan_id;

  PERFORM public.notify_admins(
    'New payment awaiting verification',
    COALESCE(v_email, 'A user') || ' submitted PKR ' || NEW.amount_pkr
      || ' for ' || COALESCE(v_plan_name, 'a plan') || '. Please review.',
    'warning',
    '/admin?section=finance'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_payment_submitted_notify_admins ON public.manual_payments;
CREATE TRIGGER on_payment_submitted_notify_admins
  AFTER INSERT ON public.manual_payments
  FOR EACH ROW EXECUTE FUNCTION public.on_payment_submitted_notify_admins();

-- ── Backfill: create missing profiles for users who signed up
--    while the broken trigger was blocking profile creation ────
INSERT INTO public.profiles (id, email, full_name, selected_plan, updated_at)
SELECT
  u.id,
  u.email,
  COALESCE(
    NULLIF(TRIM(
      COALESCE(u.raw_user_meta_data->>'first_name','') || ' ' ||
      COALESCE(u.raw_user_meta_data->>'last_name','')
    ), ''),
    u.raw_user_meta_data->>'full_name',
    SPLIT_PART(u.email, '@', 1)
  ),
  COALESCE(u.raw_user_meta_data->>'selected_plan', 'individual_starter'),
  now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- Backfill missing user_roles rows
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'teacher'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
ON CONFLICT (user_id, role) DO NOTHING;

-- Backfill missing user_credits rows
INSERT INTO public.user_credits (user_id, balance, total_earned, total_spent)
SELECT u.id, 0, 0, 0
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_credits c WHERE c.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- Backfill missing subscriptions (assign individual_starter)
INSERT INTO public.user_subscriptions (user_id, plan_id, status, expires_at)
SELECT u.id, p.id, 'active', NULL
FROM auth.users u
CROSS JOIN (SELECT id FROM public.plans WHERE slug = 'individual_starter' LIMIT 1) p
WHERE NOT EXISTS (SELECT 1 FROM public.user_subscriptions s WHERE s.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;
