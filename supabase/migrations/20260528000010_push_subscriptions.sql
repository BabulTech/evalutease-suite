-- ============================================================
-- Native push notifications: per-device FCM/APNs token storage
-- + register/unregister RPCs + trigger that fires send-push on
-- every notification INSERT.
--
-- Server-side setup (after running this migration):
--   1. In Supabase Dashboard > Settings > Edge Functions > Secrets, add:
--        FCM_PROJECT_ID         = your Firebase project ID
--        FCM_SERVICE_ACCOUNT    = full service-account JSON (one line)
--   2. In Supabase Dashboard > Settings > Database > Vault (or via SQL),
--      set the project ref + service-role key the trigger uses below:
--        SELECT vault.create_secret('https://<ref>.supabase.co', 'project_url');
--        SELECT vault.create_secret('<service-role-key>',        'service_role_key');
--      (Skip if you prefer using Supabase Database Webhooks instead of the
--       inline trigger — see send-push function for details.)
-- ============================================================

-- ── Table: one row per device per user ─────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL,                                   -- FCM/APNs device token
  platform     TEXT NOT NULL CHECK (platform IN ('android','ios','web')),
  device_name  TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own push subs" ON public.push_subscriptions;
CREATE POLICY "users manage own push subs" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── RPC: client calls this from Capacitor after FCM token registration ──
CREATE OR REPLACE FUNCTION public.register_push_token(
  p_token       TEXT,
  p_platform    TEXT,
  p_device_name TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF p_token IS NULL OR length(trim(p_token)) < 10 THEN
    RAISE EXCEPTION 'invalid token';
  END IF;
  IF p_platform NOT IN ('android','ios','web') THEN
    RAISE EXCEPTION 'invalid platform';
  END IF;

  INSERT INTO public.push_subscriptions (user_id, token, platform, device_name)
    VALUES (auth.uid(), p_token, p_platform, p_device_name)
    ON CONFLICT (user_id, token) DO UPDATE
      SET platform     = EXCLUDED.platform,
          device_name  = COALESCE(EXCLUDED.device_name, public.push_subscriptions.device_name),
          last_seen_at = now()
    RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_push_token(TEXT, TEXT, TEXT) TO authenticated;

-- ── RPC: client calls this on sign-out to release the token ──
CREATE OR REPLACE FUNCTION public.unregister_push_token(p_token TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  DELETE FROM public.push_subscriptions WHERE user_id = auth.uid() AND token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unregister_push_token(TEXT) TO authenticated;
