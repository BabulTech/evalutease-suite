-- Notify all admins when a specific event happens
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_admins(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ── Trigger: notify admins when a new user signs up ──────────
CREATE OR REPLACE FUNCTION public.on_new_user_notify_admins()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email TEXT;
  v_name  TEXT;
BEGIN
  v_email := NEW.email;
  v_name  := COALESCE(
    NEW.raw_user_meta_data->>'first_name' || ' ' || NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'full_name',
    v_email
  );
  PERFORM public.notify_admins(
    'New user registered',
    v_name || ' (' || v_email || ') just created an account.',
    'info',
    '/admin'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block signup due to notification failure
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_user_notify_admins ON auth.users;
CREATE TRIGGER on_new_user_notify_admins
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.on_new_user_notify_admins();

-- ── Trigger: notify admins when a payment screenshot is submitted ──
CREATE OR REPLACE FUNCTION public.on_payment_submitted_notify_admins()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email     TEXT;
  v_plan_name TEXT;
BEGIN
  SELECT u.email INTO v_email
  FROM auth.users u WHERE u.id = NEW.user_id;

  SELECT p.name INTO v_plan_name
  FROM public.plans p WHERE p.id = NEW.plan_id;

  PERFORM public.notify_admins(
    'New payment awaiting verification',
    COALESCE(v_email, 'A user') || ' submitted a payment of PKR ' || NEW.amount_pkr
      || ' for ' || COALESCE(v_plan_name, 'a plan') || '. Please review.',
    'warning',
    '/admin'
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
