-- ============================================================
-- PLAN RESTRUCTURE v2
-- New 4-plan model with credit packages, trial system,
-- blocked email domains, and add-on credit packages.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- STEP 1: Ensure all required columns exist on plans
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS scheduled_quizzes_per_day  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS watermark_enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS trial_days                  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_ai_calls              INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS can_buy_credits             BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS file_export_watermark       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_template_allowed      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order                  INTEGER NOT NULL DEFAULT 0;

-- ────────────────────────────────────────────────────────────
-- STEP 2: Delete old plans and insert clean 4-plan structure
-- (Safe: user_subscriptions will be migrated below)
-- ────────────────────────────────────────────────────────────

-- Migrate existing subscribers to closest new plan before delete
UPDATE public.user_subscriptions us
SET plan_id = (SELECT id FROM public.plans WHERE slug = 'individual_pro' LIMIT 1)
WHERE EXISTS (
  SELECT 1 FROM public.plans p
  WHERE p.id = us.plan_id
    AND p.slug IN ('individual_pro','individual_pro_plus')
);

UPDATE public.user_subscriptions us
SET plan_id = (SELECT id FROM public.plans WHERE slug = 'enterprise_pro' LIMIT 1)
WHERE EXISTS (
  SELECT 1 FROM public.plans p
  WHERE p.id = us.plan_id
    AND p.slug IN ('enterprise_starter','enterprise_pro','enterprise_elite')
);

-- Remove old plans that no longer exist
DELETE FROM public.plans
WHERE slug NOT IN ('individual_starter','individual_pro','enterprise_starter','enterprise_pro');

-- ────────────────────────────────────────────────────────────
-- STEP 3: Upsert the 4 canonical plans
-- ────────────────────────────────────────────────────────────

-- 1) Individual Free (Starter)
INSERT INTO public.plans (
  slug, tier, name, description, price_pkr, credits_per_month, sort_order, is_active,
  quizzes_per_day, scheduled_quizzes_per_day, participants_per_session,
  participants_total, question_bank, sessions_total, max_hosts,
  ai_calls_per_day, ai_enabled, custom_branding, white_label,
  ai_interview, ai_coding_test,
  watermark_enabled, file_export_watermark, email_template_allowed,
  trial_days, trial_ai_calls, can_buy_credits,
  credit_cost_ai_10q, credit_cost_ai_scan, credit_cost_ai_interview,
  credit_cost_ai_coding, credit_cost_ai_grade_short, credit_cost_ai_grade_long,
  credit_cost_extra_quiz, credit_cost_extra_participants,
  credit_cost_session_launch, credit_cost_export,
  features_list
) VALUES (
  'individual_starter','individual','Individual Free',
  'Perfect for individuals and small classrooms just getting started.',
  0, 0, 0, true,
  3, 1, 50,
  50, 100, -1, 1,
  0, false, false, false,
  false, false,
  true, true, false,
  0, 0, false,
  3, 2, 5, 5, 1, 3,
  1, 1, 0, 0,
  ARRAY[
    '3 Quiz Sessions per day',
    '1 Scheduled Quiz per day',
    '100 Question Bank',
    '50 Active Participants',
    'MCQs & True/False only',
    'File export with watermark',
    'Basic Analytics',
    'No AI features'
  ]
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_pkr = EXCLUDED.price_pkr,
  credits_per_month = EXCLUDED.credits_per_month,
  sort_order = EXCLUDED.sort_order,
  quizzes_per_day = EXCLUDED.quizzes_per_day,
  scheduled_quizzes_per_day = EXCLUDED.scheduled_quizzes_per_day,
  participants_per_session = EXCLUDED.participants_per_session,
  participants_total = EXCLUDED.participants_total,
  question_bank = EXCLUDED.question_bank,
  sessions_total = EXCLUDED.sessions_total,
  max_hosts = EXCLUDED.max_hosts,
  ai_calls_per_day = EXCLUDED.ai_calls_per_day,
  ai_enabled = EXCLUDED.ai_enabled,
  custom_branding = EXCLUDED.custom_branding,
  white_label = EXCLUDED.white_label,
  watermark_enabled = EXCLUDED.watermark_enabled,
  file_export_watermark = EXCLUDED.file_export_watermark,
  email_template_allowed = EXCLUDED.email_template_allowed,
  trial_days = EXCLUDED.trial_days,
  trial_ai_calls = EXCLUDED.trial_ai_calls,
  can_buy_credits = EXCLUDED.can_buy_credits,
  credit_cost_ai_10q = EXCLUDED.credit_cost_ai_10q,
  credit_cost_ai_scan = EXCLUDED.credit_cost_ai_scan,
  features_list = EXCLUDED.features_list,
  updated_at = now();

-- 2) Individual Pro
INSERT INTO public.plans (
  slug, tier, name, description, price_pkr, credits_per_month, sort_order, is_active,
  quizzes_per_day, scheduled_quizzes_per_day, participants_per_session,
  participants_total, question_bank, sessions_total, max_hosts,
  ai_calls_per_day, ai_enabled, custom_branding, white_label,
  ai_interview, ai_coding_test,
  watermark_enabled, file_export_watermark, email_template_allowed,
  trial_days, trial_ai_calls, can_buy_credits,
  credit_cost_ai_10q, credit_cost_ai_scan, credit_cost_ai_interview,
  credit_cost_ai_coding, credit_cost_ai_grade_short, credit_cost_ai_grade_long,
  credit_cost_extra_quiz, credit_cost_extra_participants,
  credit_cost_session_launch, credit_cost_export,
  features_list
) VALUES (
  'individual_pro','individual','Individual Pro',
  'Unlimited power for serious educators — full AI access included.',
  299, 100, 1, true,
  -1, -1, -1,
  -1, -1, -1, 1,
  -1, true, true, false,
  false, false,
  false, false, true,
  0, 0, true,
  3, 2, 5, 5, 1, 3,
  1, 1, 0, 0,
  ARRAY[
    'Unlimited Quiz Sessions',
    'Unlimited Scheduled Quizzes',
    'Unlimited Question Bank',
    'Unlimited Participants',
    'All Question Types',
    'AI Question Generation (credit-based)',
    'AI OCR Image Scan (credit-based)',
    'Custom Branding & Logo',
    'Custom Email Templates',
    'Advanced Analytics',
    'Export without watermark',
    'Buy additional credits anytime'
  ]
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_pkr = EXCLUDED.price_pkr,
  credits_per_month = EXCLUDED.credits_per_month,
  sort_order = EXCLUDED.sort_order,
  quizzes_per_day = EXCLUDED.quizzes_per_day,
  scheduled_quizzes_per_day = EXCLUDED.scheduled_quizzes_per_day,
  participants_per_session = EXCLUDED.participants_per_session,
  participants_total = EXCLUDED.participants_total,
  question_bank = EXCLUDED.question_bank,
  sessions_total = EXCLUDED.sessions_total,
  max_hosts = EXCLUDED.max_hosts,
  ai_calls_per_day = EXCLUDED.ai_calls_per_day,
  ai_enabled = EXCLUDED.ai_enabled,
  custom_branding = EXCLUDED.custom_branding,
  white_label = EXCLUDED.white_label,
  watermark_enabled = EXCLUDED.watermark_enabled,
  file_export_watermark = EXCLUDED.file_export_watermark,
  email_template_allowed = EXCLUDED.email_template_allowed,
  trial_days = EXCLUDED.trial_days,
  trial_ai_calls = EXCLUDED.trial_ai_calls,
  can_buy_credits = EXCLUDED.can_buy_credits,
  credit_cost_ai_10q = EXCLUDED.credit_cost_ai_10q,
  credit_cost_ai_scan = EXCLUDED.credit_cost_ai_scan,
  features_list = EXCLUDED.features_list,
  updated_at = now();

-- 3) Enterprise Starter (Free Trial)
INSERT INTO public.plans (
  slug, tier, name, description, price_pkr, credits_per_month, sort_order, is_active,
  quizzes_per_day, scheduled_quizzes_per_day, participants_per_session,
  participants_total, question_bank, sessions_total, max_hosts,
  ai_calls_per_day, ai_enabled, custom_branding, white_label,
  ai_interview, ai_coding_test,
  watermark_enabled, file_export_watermark, email_template_allowed,
  trial_days, trial_ai_calls, can_buy_credits,
  credit_cost_ai_10q, credit_cost_ai_scan, credit_cost_ai_interview,
  credit_cost_ai_coding, credit_cost_ai_grade_short, credit_cost_ai_grade_long,
  credit_cost_extra_quiz, credit_cost_extra_participants,
  credit_cost_session_launch, credit_cost_export,
  features_list
) VALUES (
  'enterprise_starter','enterprise','Enterprise Trial',
  '15-day free trial for organisations. 10 complimentary AI calls included.',
  0, 0, 2, true,
  3, 1, 50,
  50, 100, -1, 2,
  0, true, false, false,
  false, false,
  true, true, false,
  15, 10, false,
  3, 2, 5, 5, 1, 3,
  1, 1, 0, 0,
  ARRAY[
    '15-day free trial',
    '3 Quiz Sessions per day',
    '1 Scheduled Quiz per day',
    '100 Question Bank',
    '50 Active Participants',
    '10 complimentary AI calls',
    'Up to 2 Hosts',
    'File export with watermark',
    'Basic Analytics',
    'Company email required (no Gmail/Yahoo)'
  ]
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_pkr = EXCLUDED.price_pkr,
  credits_per_month = EXCLUDED.credits_per_month,
  sort_order = EXCLUDED.sort_order,
  quizzes_per_day = EXCLUDED.quizzes_per_day,
  scheduled_quizzes_per_day = EXCLUDED.scheduled_quizzes_per_day,
  participants_per_session = EXCLUDED.participants_per_session,
  participants_total = EXCLUDED.participants_total,
  question_bank = EXCLUDED.question_bank,
  sessions_total = EXCLUDED.sessions_total,
  max_hosts = EXCLUDED.max_hosts,
  ai_calls_per_day = EXCLUDED.ai_calls_per_day,
  ai_enabled = EXCLUDED.ai_enabled,
  custom_branding = EXCLUDED.custom_branding,
  white_label = EXCLUDED.white_label,
  watermark_enabled = EXCLUDED.watermark_enabled,
  file_export_watermark = EXCLUDED.file_export_watermark,
  email_template_allowed = EXCLUDED.email_template_allowed,
  trial_days = EXCLUDED.trial_days,
  trial_ai_calls = EXCLUDED.trial_ai_calls,
  can_buy_credits = EXCLUDED.can_buy_credits,
  features_list = EXCLUDED.features_list,
  updated_at = now();

-- 4) Enterprise Pro
INSERT INTO public.plans (
  slug, tier, name, description, price_pkr, credits_per_month, sort_order, is_active,
  quizzes_per_day, scheduled_quizzes_per_day, participants_per_session,
  participants_total, question_bank, sessions_total, max_hosts,
  ai_calls_per_day, ai_enabled, custom_branding, white_label,
  ai_interview, ai_coding_test,
  watermark_enabled, file_export_watermark, email_template_allowed,
  trial_days, trial_ai_calls, can_buy_credits,
  credit_cost_ai_10q, credit_cost_ai_scan, credit_cost_ai_interview,
  credit_cost_ai_coding, credit_cost_ai_grade_short, credit_cost_ai_grade_long,
  credit_cost_extra_quiz, credit_cost_extra_participants,
  credit_cost_session_launch, credit_cost_export,
  features_list
) VALUES (
  'enterprise_pro','enterprise','Enterprise Pro',
  'Full power for large organisations. Unlimited hosts, AI, and analytics.',
  4999, 1500, 3, true,
  -1, -1, -1,
  -1, -1, -1, -1,
  -1, true, true, true,
  true, true,
  false, false, true,
  0, 0, true,
  3, 2, 5, 5, 1, 3,
  1, 1, 0, 0,
  ARRAY[
    'Unlimited Quiz Sessions',
    'Unlimited Scheduled Quizzes',
    'Unlimited Question Bank',
    'Unlimited Participants',
    'All Question Types',
    'AI Question Generation (credit-based)',
    'AI OCR Scan (credit-based)',
    'AI Interviews & Coding Tests',
    'Unlimited Hosts',
    'White Label & Custom Branding',
    'Custom Email Templates',
    'Advanced Analytics & Reports',
    'Export without watermark',
    'Buy additional credits anytime',
    'Company email required'
  ]
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_pkr = EXCLUDED.price_pkr,
  credits_per_month = EXCLUDED.credits_per_month,
  sort_order = EXCLUDED.sort_order,
  quizzes_per_day = EXCLUDED.quizzes_per_day,
  scheduled_quizzes_per_day = EXCLUDED.scheduled_quizzes_per_day,
  participants_per_session = EXCLUDED.participants_per_session,
  participants_total = EXCLUDED.participants_total,
  question_bank = EXCLUDED.question_bank,
  sessions_total = EXCLUDED.sessions_total,
  max_hosts = EXCLUDED.max_hosts,
  ai_calls_per_day = EXCLUDED.ai_calls_per_day,
  ai_enabled = EXCLUDED.ai_enabled,
  custom_branding = EXCLUDED.custom_branding,
  white_label = EXCLUDED.white_label,
  watermark_enabled = EXCLUDED.watermark_enabled,
  file_export_watermark = EXCLUDED.file_export_watermark,
  email_template_allowed = EXCLUDED.email_template_allowed,
  trial_days = EXCLUDED.trial_days,
  trial_ai_calls = EXCLUDED.trial_ai_calls,
  can_buy_credits = EXCLUDED.can_buy_credits,
  credit_cost_ai_10q = EXCLUDED.credit_cost_ai_10q,
  credit_cost_ai_scan = EXCLUDED.credit_cost_ai_scan,
  features_list = EXCLUDED.features_list,
  updated_at = now();

-- ────────────────────────────────────────────────────────────
-- STEP 4: Add-on credit packages table
-- Admin can create, edit, enable/disable packages
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_packages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  credits      INTEGER NOT NULL CHECK (credits > 0 AND credits <= 100000),
  price_pkr    INTEGER NOT NULL CHECK (price_pkr > 0),
  badge_text   TEXT,          -- e.g. "Best Value", "Popular"
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  -- Which plan tiers can buy this package
  allowed_tiers TEXT[] NOT NULL DEFAULT ARRAY['individual','enterprise'],
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads active packages" ON public.credit_packages
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage packages" ON public.credit_packages
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default add-on packages
INSERT INTO public.credit_packages (name, credits, price_pkr, badge_text, sort_order) VALUES
  ('Starter Pack',  50,  79,  NULL,         0),
  ('Value Pack',   150, 199,  'Popular',    1),
  ('Power Pack',   500, 599,  'Best Value', 2)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- STEP 5: Blocked email domains table
-- Admin manages which domains are blocked for Enterprise signup
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.blocked_email_domains (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain     TEXT NOT NULL UNIQUE,
  reason     TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_email_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage blocked domains" ON public.blocked_email_domains
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Service role can read for validation
CREATE POLICY "Service reads domains" ON public.blocked_email_domains
  FOR SELECT USING (true);

-- Seed common public email domains
INSERT INTO public.blocked_email_domains (domain, reason) VALUES
  ('gmail.com',      'Public email provider'),
  ('yahoo.com',      'Public email provider'),
  ('hotmail.com',    'Public email provider'),
  ('outlook.com',    'Public email provider'),
  ('live.com',       'Public email provider'),
  ('msn.com',        'Public email provider'),
  ('icloud.com',     'Public email provider'),
  ('protonmail.com', 'Public email provider'),
  ('proton.me',      'Public email provider'),
  ('yandex.com',     'Public email provider'),
  ('mail.com',       'Public email provider'),
  ('zohomail.com',   'Public email provider'),
  ('inbox.com',      'Public email provider'),
  ('me.com',         'Public email provider'),
  ('aol.com',        'Public email provider')
ON CONFLICT (domain) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- STEP 6: Trial AI usage tracker
-- Tracks the 10 free AI calls for Enterprise Trial users
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trial_ai_usage (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_calls  INTEGER NOT NULL DEFAULT 0,
  trial_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_end   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.trial_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own trial usage" ON public.trial_ai_usage
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins read all trial usage" ON public.trial_ai_usage
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ────────────────────────────────────────────────────────────
-- STEP 7: Function to validate enterprise email domain
-- Returns TRUE if domain is allowed (not blocked)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_enterprise_email_allowed(p_email TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.blocked_email_domains
    WHERE domain = lower(split_part(p_email, '@', 2))
      AND is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_enterprise_email_allowed(TEXT) TO authenticated, anon;

-- ────────────────────────────────────────────────────────────
-- STEP 8: Function to check + consume a trial AI call
-- Returns TRUE if call was allowed and consumed, FALSE if exhausted
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consume_trial_ai_call(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row   public.trial_ai_usage%ROWTYPE;
  v_limit INTEGER;
BEGIN
  -- Get limit from the enterprise_starter plan
  SELECT trial_ai_calls INTO v_limit
  FROM public.plans WHERE slug = 'enterprise_starter' LIMIT 1;
  v_limit := COALESCE(v_limit, 10);

  -- Upsert usage row
  INSERT INTO public.trial_ai_usage (user_id, used_calls)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row FROM public.trial_ai_usage
  WHERE user_id = p_user_id FOR UPDATE;

  -- Check trial not expired
  IF v_row.trial_end < now() THEN RETURN FALSE; END IF;

  -- Check limit
  IF v_row.used_calls >= v_limit THEN RETURN FALSE; END IF;

  UPDATE public.trial_ai_usage
  SET used_calls = used_calls + 1, updated_at = now()
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_trial_ai_call(UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- STEP 9: Function to expire trial subscriptions
-- Run this daily via pg_cron or Supabase edge function
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.expire_trials()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_starter_id UUID;
  v_free_id    UUID;
  v_count      INTEGER := 0;
BEGIN
  SELECT id INTO v_starter_id FROM public.plans WHERE slug = 'enterprise_starter' LIMIT 1;
  SELECT id INTO v_free_id    FROM public.plans WHERE slug = 'individual_starter' LIMIT 1;

  IF v_starter_id IS NULL OR v_free_id IS NULL THEN RETURN 0; END IF;

  -- Downgrade expired trial users to individual_starter (free)
  UPDATE public.user_subscriptions us
  SET plan_id    = v_free_id,
      status     = 'active',
      expires_at = NULL,
      updated_at = now()
  FROM public.trial_ai_usage tau
  WHERE us.plan_id = v_starter_id
    AND us.status  = 'active'
    AND tau.user_id = us.user_id
    AND tau.trial_end < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Only service_role / pg_cron should call this
REVOKE EXECUTE ON FUNCTION public.expire_trials() FROM authenticated, anon;

-- ────────────────────────────────────────────────────────────
-- STEP 10: Add expires_at column to user_subscriptions if missing
-- (needed for trial expiry tracking)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Auto-set expires_at when enterprise_starter plan is assigned
CREATE OR REPLACE FUNCTION public._set_trial_expiry()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_trial_days INTEGER;
  v_slug       TEXT;
BEGIN
  SELECT slug, trial_days INTO v_slug, v_trial_days
  FROM public.plans WHERE id = NEW.plan_id;

  IF v_slug = 'enterprise_starter' AND v_trial_days > 0 THEN
    NEW.expires_at := now() + (v_trial_days || ' days')::INTERVAL;

    -- Init trial AI usage tracker
    INSERT INTO public.trial_ai_usage (user_id, trial_start, trial_end)
    VALUES (NEW.user_id, now(), now() + (v_trial_days || ' days')::INTERVAL)
    ON CONFLICT (user_id) DO UPDATE
      SET trial_start = now(),
          trial_end   = now() + (v_trial_days || ' days')::INTERVAL,
          used_calls  = 0,
          updated_at  = now();
  ELSE
    NEW.expires_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_trial_expiry ON public.user_subscriptions;
CREATE TRIGGER trg_set_trial_expiry
  BEFORE INSERT OR UPDATE OF plan_id ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public._set_trial_expiry();

-- ────────────────────────────────────────────────────────────
-- STEP 11: Update PlanContext fields in plans (fix ai_enabled
-- for enterprise plans which was false previously)
-- ────────────────────────────────────────────────────────────
UPDATE public.plans
SET ai_enabled = true
WHERE slug IN ('individual_pro', 'enterprise_starter', 'enterprise_pro');

UPDATE public.plans
SET can_buy_credits = true
WHERE slug IN ('individual_pro', 'enterprise_pro');

-- updated_at trigger for credit_packages
CREATE OR REPLACE FUNCTION public._touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS touch_credit_packages_updated_at ON public.credit_packages;
CREATE TRIGGER touch_credit_packages_updated_at
  BEFORE UPDATE ON public.credit_packages
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();
