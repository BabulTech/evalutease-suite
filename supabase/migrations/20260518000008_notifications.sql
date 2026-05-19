-- ============================================================
-- Notifications system
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT,
  type         TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info','success','warning','error')),
  link         TEXT,
  read         BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread ON public.notifications (user_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_notifications" ON public.notifications;
CREATE POLICY "users_own_notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);

-- ─── Helper: create a notification for a user ───────────────
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title   TEXT,
  p_body    TEXT DEFAULT NULL,
  p_type    TEXT DEFAULT 'info',
  p_link    TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type, link)
  VALUES (p_user_id, p_title, p_body, p_type, p_link);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ─── Trigger: notify org admin when trial expires ───────────
DROP FUNCTION IF EXISTS public.expire_trials();
CREATE OR REPLACE FUNCTION public.expire_trials()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  v_free_plan_id   UUID;
  v_ent_free_id    UUID;
BEGIN
  SELECT id INTO v_ent_free_id  FROM public.plans WHERE slug = 'enterprise_free'   LIMIT 1;
  SELECT id INTO v_free_plan_id FROM public.plans WHERE slug = 'individual_starter' LIMIT 1;

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
    SET plan_id    = COALESCE(v_ent_free_id, v_free_plan_id),
        status     = 'active',
        expires_at = NULL,
        updated_at = now()
    WHERE user_id = r.user_id;

    PERFORM public.create_notification(
      r.user_id,
      'Your Enterprise Trial has ended',
      'You have been moved to Enterprise Free. Upgrade to Enterprise Pro to unlock AI and paid features.',
      'warning',
      '/billing'
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_trials() TO service_role;

-- ─── Trigger: notify when manual payment is approved ────────
CREATE OR REPLACE FUNCTION public.notify_payment_approved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    PERFORM public.create_notification(
      NEW.user_id,
      'Payment approved',
      'Your payment has been verified and your plan has been upgraded.',
      'success',
      '/billing'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_payment_approved ON public.manual_payments;
CREATE TRIGGER on_payment_approved
  AFTER UPDATE ON public.manual_payments
  FOR EACH ROW EXECUTE FUNCTION public.notify_payment_approved();

-- ─── Trigger: notify when host invite is created ────────────
CREATE OR REPLACE FUNCTION public.notify_host_invited()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org_name TEXT;
BEGIN
  SELECT cp.company_name INTO v_org_name
  FROM public.company_profiles cp
  WHERE cp.admin_user_id = NEW.invited_by
  LIMIT 1;

  PERFORM public.create_notification(
    NEW.user_id,
    'You joined ' || COALESCE(v_org_name, 'an organisation') || ' as a Host',
    'Welcome! You now have access to the organisation''s quiz sessions.',
    'success',
    '/company'
  );
  RETURN NEW;
END;
$$;

-- Fire when user_id is set (host accepted invite), not on initial INSERT when user_id is still NULL
DROP TRIGGER IF EXISTS on_host_invited ON public.company_members;
CREATE TRIGGER on_host_invited
  AFTER UPDATE ON public.company_members
  FOR EACH ROW
  WHEN (OLD.user_id IS NULL AND NEW.user_id IS NOT NULL)
  EXECUTE FUNCTION public.notify_host_invited();
