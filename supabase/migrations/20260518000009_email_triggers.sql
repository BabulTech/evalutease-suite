-- ============================================================
-- Email triggers — calls send-email Edge Function via pg_net
-- ============================================================

-- ─── Helper: invoke send-email edge function ────────────────
CREATE OR REPLACE FUNCTION public.send_app_email(
  p_type TEXT,
  p_data JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_url TEXT;
BEGIN
  v_url := current_setting('app.edge_function_url', true);
  IF v_url IS NULL OR v_url = '' THEN
    -- Fallback: derive from Supabase project URL stored in vault/env
    v_url := current_setting('app.supabase_url', true) || '/functions/v1/send-email';
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := jsonb_build_object('type', p_type, 'data', p_data)
  );
EXCEPTION WHEN OTHERS THEN
  -- Never block the main transaction for email failures
  RAISE WARNING 'send_app_email failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_app_email(TEXT, JSONB) TO service_role;

-- ─── expire_trials: send email on trial expiry ──────────────
-- Drop and recreate to include email notification
DROP FUNCTION IF EXISTS public.expire_trials();
CREATE OR REPLACE FUNCTION public.expire_trials()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r          RECORD;
  v_ent_free UUID;
  v_ind_free UUID;
  v_name     TEXT;
  v_email    TEXT;
  v_app_url  TEXT;
BEGIN
  SELECT id INTO v_ent_free FROM public.plans WHERE slug = 'enterprise_free'    LIMIT 1;
  SELECT id INTO v_ind_free FROM public.plans WHERE slug = 'individual_starter' LIMIT 1;
  v_app_url := COALESCE(current_setting('app.url', true), 'https://evalutease.com');

  FOR r IN
    SELECT us.user_id
    FROM public.user_subscriptions us
    JOIN public.plans p ON p.id = us.plan_id
    WHERE p.slug = 'enterprise_starter'
      AND us.status = 'active'
      AND us.expires_at IS NOT NULL
      AND us.expires_at < now()
  LOOP
    UPDATE public.user_subscriptions
    SET plan_id    = COALESCE(v_ent_free, v_ind_free),
        status     = 'active',
        expires_at = NULL,
        updated_at = now()
    WHERE user_id = r.user_id;

    -- In-app notification
    PERFORM public.create_notification(
      r.user_id,
      'Your Enterprise Trial has ended',
      'You have been moved to Enterprise Free. Upgrade to Enterprise Pro to unlock AI and paid features.',
      'warning',
      '/billing'
    );

    -- Email notification
    SELECT
      COALESCE(pr.full_name, split_part(au.email, '@', 1)),
      au.email
    INTO v_name, v_email
    FROM auth.users au
    LEFT JOIN public.profiles pr ON pr.id = au.id
    WHERE au.id = r.user_id;

    PERFORM public.send_app_email('trial_expired', jsonb_build_object(
      'to',     v_email,
      'name',   v_name,
      'appUrl', v_app_url
    ));
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_trials() TO service_role;

-- ─── Trial expiring soon (3-day warning) ────────────────────
CREATE OR REPLACE FUNCTION public.warn_expiring_trials()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r         RECORD;
  v_name    TEXT;
  v_email   TEXT;
  v_days    INT;
  v_app_url TEXT;
BEGIN
  v_app_url := COALESCE(current_setting('app.url', true), 'https://evalutease.com');

  FOR r IN
    SELECT us.user_id, us.expires_at
    FROM public.user_subscriptions us
    JOIN public.plans p ON p.id = us.plan_id
    WHERE p.slug = 'enterprise_starter'
      AND us.status = 'active'
      AND us.expires_at IS NOT NULL
      AND us.expires_at > now()
      AND us.expires_at <= now() + INTERVAL '3 days'
      -- Only send once: check no warning notification sent in last 24h
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = us.user_id
          AND n.title LIKE 'Your Enterprise Trial expires%'
          AND n.created_at > now() - INTERVAL '24 hours'
      )
  LOOP
    v_days := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (r.expires_at - now())) / 86400)::INT);

    SELECT
      COALESCE(pr.full_name, split_part(au.email, '@', 1)),
      au.email
    INTO v_name, v_email
    FROM auth.users au
    LEFT JOIN public.profiles pr ON pr.id = au.id
    WHERE au.id = r.user_id;

    -- In-app notification
    PERFORM public.create_notification(
      r.user_id,
      'Your Enterprise Trial expires in ' || v_days || ' day' || CASE WHEN v_days = 1 THEN '' ELSE 's' END,
      'Upgrade to Enterprise Pro to keep AI access and premium features.',
      'warning',
      '/billing'
    );

    -- Email
    PERFORM public.send_app_email('trial_expiring', jsonb_build_object(
      'to',     v_email,
      'name',   v_name,
      'days',   v_days::TEXT,
      'appUrl', v_app_url
    ));
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.warn_expiring_trials() TO service_role;

-- Cron: run warning check daily at 8am UTC
SELECT cron.schedule(
  'warn-expiring-trials',
  '0 8 * * *',
  $$ SELECT public.warn_expiring_trials(); $$
);

-- ─── Payment approved: send email ───────────────────────────
DROP TRIGGER IF EXISTS on_payment_approved ON public.manual_payments;
DROP FUNCTION IF EXISTS public.notify_payment_approved();

CREATE OR REPLACE FUNCTION public.notify_payment_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name     TEXT;
  v_email    TEXT;
  v_plan     TEXT;
  v_app_url  TEXT;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    v_app_url := COALESCE(current_setting('app.url', true), 'https://evalutease.com');

    SELECT
      COALESCE(pr.full_name, split_part(au.email, '@', 1)),
      au.email
    INTO v_name, v_email
    FROM auth.users au
    LEFT JOIN public.profiles pr ON pr.id = au.id
    WHERE au.id = NEW.user_id;

    SELECT p.name INTO v_plan
    FROM public.plans p
    WHERE p.id = NEW.plan_id
    LIMIT 1;

    -- In-app notification
    PERFORM public.create_notification(
      NEW.user_id,
      'Payment approved',
      'Your payment has been verified and your plan has been upgraded.',
      'success',
      '/billing'
    );

    -- Email to user
    PERFORM public.send_app_email('payment_approved', jsonb_build_object(
      'to',       v_email,
      'name',     v_name,
      'planName', COALESCE(v_plan, 'your new plan'),
      'appUrl',   v_app_url
    ));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_approved
  AFTER UPDATE ON public.manual_payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_payment_approved();

-- ─── Payment submitted: notify admin ────────────────────────
CREATE OR REPLACE FUNCTION public.notify_payment_submitted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name      TEXT;
  v_email     TEXT;
  v_plan      TEXT;
  v_admin_email TEXT;
  v_app_url   TEXT;
BEGIN
  v_app_url := COALESCE(current_setting('app.url', true), 'https://evalutease.com');

  SELECT
    COALESCE(pr.full_name, split_part(au.email, '@', 1)),
    au.email
  INTO v_name, v_email
  FROM auth.users au
  LEFT JOIN public.profiles pr ON pr.id = au.id
  WHERE au.id = NEW.user_id;

  SELECT p.name INTO v_plan
  FROM public.plans p WHERE p.id = NEW.plan_id LIMIT 1;

  v_admin_email := current_setting('app.admin_email', true);

  -- Email to user: payment received confirmation
  PERFORM public.send_app_email('payment_submitted', jsonb_build_object(
    'to',     v_email,
    'name',   v_name,
    'amount', NEW.amount_pkr::TEXT,
    'appUrl', v_app_url
  ));

  -- Email to admin (if configured)
  IF v_admin_email IS NOT NULL AND v_admin_email <> '' THEN
    PERFORM public.send_app_email('payment_admin_alert', jsonb_build_object(
      'to',        v_admin_email,
      'userName',  v_name,
      'userEmail', v_email,
      'amount',    NEW.amount_pkr::TEXT,
      'planName',  COALESCE(v_plan, 'Unknown'),
      'adminUrl',  v_app_url || '/admin'
    ));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_payment_submitted ON public.manual_payments;
CREATE TRIGGER on_payment_submitted
  AFTER INSERT ON public.manual_payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_payment_submitted();

-- ─── Host invite: update send-host-invite to use send-email ─
-- (No SQL trigger needed — client calls send-email directly)
-- See: src/routes/_app/company.tsx — update invoke to use 'send-email'
