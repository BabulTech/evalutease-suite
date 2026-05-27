-- Update admin notification trigger functions to use section-specific links

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
  RETURN NEW;
END;
$$;

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
