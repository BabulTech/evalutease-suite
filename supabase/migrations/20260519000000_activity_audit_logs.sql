-- ============================================================
-- Activity audit, AI usage/cost tracking, and security alerts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_email TEXT,
  plan_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  module TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  entity_label TEXT,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON public.activity_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_plan_owner ON public.activity_logs(plan_owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON public.activity_logs(module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_details_gin ON public.activity_logs USING gin(details);

CREATE TABLE IF NOT EXISTS public.ai_model_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'anthropic',
  model TEXT NOT NULL,
  input_cost_per_million NUMERIC(12, 6) NOT NULL DEFAULT 0,
  output_cost_per_million NUMERIC(12, 6) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, model)
);

INSERT INTO public.ai_model_pricing (provider, model, input_cost_per_million, output_cost_per_million, currency)
VALUES
  ('anthropic', 'claude-haiku-4-5-20251001', 0.800000, 4.000000, 'USD')
ON CONFLICT (provider, model) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  plan_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'anthropic',
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  estimated_cost NUMERIC(14, 6) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  credits_charged INTEGER NOT NULL DEFAULT 0 CHECK (credits_charged >= 0),
  request_status TEXT NOT NULL DEFAULT 'success',
  latency_ms INTEGER,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON public.ai_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_actor ON public.ai_usage_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_plan_owner ON public.ai_usage_logs(plan_owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON public.ai_usage_logs(feature, created_at DESC);

CREATE TABLE IF NOT EXISTS public.security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  alert_type TEXT NOT NULL,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  plan_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON public.security_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON public.security_alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON public.security_alerts(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_actor ON public.security_alerts(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_plan_owner ON public.security_alerts(plan_owner_id, created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_model_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read activity logs" ON public.activity_logs;
CREATE POLICY "Admins read activity logs" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read ai usage logs" ON public.ai_usage_logs;
CREATE POLICY "Admins read ai usage logs" ON public.ai_usage_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read security alerts" ON public.security_alerts;
CREATE POLICY "Admins read security alerts" ON public.security_alerts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update security alerts" ON public.security_alerts;
CREATE POLICY "Admins update security alerts" ON public.security_alerts
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read ai pricing" ON public.ai_model_pricing;
CREATE POLICY "Admins read ai pricing" ON public.ai_model_pricing
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_activity(
  p_action_type TEXT,
  p_module TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_entity_label TEXT DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_plan_owner_id UUID DEFAULT NULL,
  p_risk_score INTEGER DEFAULT 0
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_id UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_actor;

  INSERT INTO public.activity_logs (
    actor_user_id, actor_name, actor_email, plan_owner_id,
    action_type, module, entity_type, entity_id, entity_label,
    message, details, metadata, risk_score
  )
  VALUES (
    v_actor,
    COALESCE(v_profile.full_name, split_part(COALESCE(v_profile.email, ''), '@', 1), 'Unknown user'),
    v_profile.email,
    COALESCE(p_plan_owner_id, v_actor),
    left(lower(trim(p_action_type)), 50),
    left(lower(trim(p_module)), 50),
    NULLIF(left(trim(COALESCE(p_entity_type, '')), 50), ''),
    p_entity_id,
    NULLIF(left(trim(COALESCE(p_entity_label, '')), 240), ''),
    COALESCE(NULLIF(trim(p_message), ''), 'Activity recorded'),
    COALESCE(p_details, '{}'::jsonb),
    COALESCE(p_metadata, '{}'::jsonb),
    GREATEST(0, LEAST(100, COALESCE(p_risk_score, 0)))
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_activity(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, JSONB, JSONB, UUID, INTEGER)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_admins_security_alert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
  v_type TEXT;
BEGIN
  v_type := CASE
    WHEN NEW.severity IN ('critical', 'high') THEN 'error'
    WHEN NEW.severity = 'medium' THEN 'warning'
    ELSE 'info'
  END;

  FOR r IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'admin'
  LOOP
    PERFORM public.create_notification(
      r.user_id,
      CASE
        WHEN NEW.severity = 'critical' THEN 'Critical security alert'
        WHEN NEW.severity = 'high' THEN 'High security alert'
        ELSE 'Security alert'
      END,
      NEW.title || ': ' || NEW.message,
      v_type,
      '/admin'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_security_alert_notify_admins ON public.security_alerts;
CREATE TRIGGER on_security_alert_notify_admins
  AFTER INSERT ON public.security_alerts
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_security_alert();

CREATE OR REPLACE VIEW public.activity_analytics_daily AS
SELECT
  date_trunc('day', created_at) AS day,
  module,
  action_type,
  count(*) AS activity_count,
  count(DISTINCT actor_user_id) AS active_users
FROM public.activity_logs
GROUP BY 1, 2, 3;

ALTER VIEW public.activity_analytics_daily SET (security_invoker = true);

CREATE OR REPLACE VIEW public.ai_usage_analytics_daily AS
SELECT
  date_trunc('day', created_at) AS day,
  feature,
  count(*) AS calls,
  sum(input_tokens) AS input_tokens,
  sum(output_tokens) AS output_tokens,
  sum(total_tokens) AS total_tokens,
  sum(estimated_cost) AS estimated_cost,
  sum(credits_charged) AS credits_charged,
  count(DISTINCT actor_user_id) AS active_users
FROM public.ai_usage_logs
GROUP BY 1, 2;

ALTER VIEW public.ai_usage_analytics_daily SET (security_invoker = true);

GRANT SELECT ON public.activity_analytics_daily TO authenticated;
GRANT SELECT ON public.ai_usage_analytics_daily TO authenticated;
