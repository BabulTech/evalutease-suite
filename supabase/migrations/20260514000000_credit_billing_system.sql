-- ============================================================
-- CREDIT-BASED BILLING SYSTEM
-- Replaces Stripe with manual payments (EasyPaisa/JazzCash/Bank)
-- ============================================================

-- Drop old Stripe-based tables
DROP TABLE IF EXISTS public.payment_history CASCADE;
DROP TABLE IF EXISTS public.user_subscriptions CASCADE;
DROP TABLE IF EXISTS public.promo_codes CASCADE;
DROP TABLE IF EXISTS public.plans CASCADE;

-- Drop old Stripe columns from profiles if any
ALTER TABLE public.profiles DROP COLUMN IF EXISTS stripe_customer_id;

-- ============================================================
-- PLANS (admin-editable)
-- ============================================================
CREATE TYPE public.plan_tier AS ENUM ('individual', 'enterprise');
CREATE TYPE public.plan_slug AS ENUM (
  'individual_starter',
  'individual_pro',
  'individual_pro_plus',
  'enterprise_starter',
  'enterprise_pro',
  'enterprise_elite'
);

CREATE TABLE public.plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                plan_slug NOT NULL UNIQUE,
  tier                plan_tier NOT NULL DEFAULT 'individual',
  name                TEXT NOT NULL,
  description         TEXT,
  price_pkr           INTEGER NOT NULL DEFAULT 0,          -- monthly price in PKR
  credits_per_month   INTEGER NOT NULL DEFAULT 0,          -- credits auto-refilled monthly
  -- Base limits (not credit-based, hard caps)
  quizzes_per_day     INTEGER NOT NULL DEFAULT 3,          -- -1 = unlimited
  participants_per_session INTEGER NOT NULL DEFAULT 50,    -- -1 = unlimited
  participants_total  INTEGER NOT NULL DEFAULT 50,         -- -1 = unlimited
  question_bank       INTEGER NOT NULL DEFAULT 50,         -- -1 = unlimited
  sessions_total      INTEGER NOT NULL DEFAULT -1,         -- -1 = unlimited
  -- Enterprise specific
  max_hosts           INTEGER NOT NULL DEFAULT 0,          -- 0 = N/A (individual), -1 = unlimited
  ai_calls_per_day    INTEGER NOT NULL DEFAULT 0,          -- 0 = no AI, -1 = unlimited (credit-based)
  -- Feature flags
  ai_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
  custom_branding     BOOLEAN NOT NULL DEFAULT FALSE,
  white_label         BOOLEAN NOT NULL DEFAULT FALSE,
  ai_interview        BOOLEAN NOT NULL DEFAULT FALSE,      -- future feature
  ai_coding_test      BOOLEAN NOT NULL DEFAULT FALSE,      -- future feature
  -- Credit costs (how many credits each action costs)
  credit_cost_ai_10q  INTEGER NOT NULL DEFAULT 3,          -- generate 10 questions
  credit_cost_ai_scan INTEGER NOT NULL DEFAULT 2,          -- OCR image scan
  credit_cost_ai_interview INTEGER NOT NULL DEFAULT 5,     -- AI interview session
  credit_cost_ai_coding    INTEGER NOT NULL DEFAULT 5,     -- AI coding test
  credit_cost_extra_quiz   INTEGER NOT NULL DEFAULT 1,     -- 1 extra quiz slot
  credit_cost_extra_participants INTEGER NOT NULL DEFAULT 1, -- 10 extra participant slots
  -- Meta
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  features_list       TEXT[] DEFAULT '{}',                 -- bullet points shown in UI
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are publicly readable" ON public.plans
  FOR SELECT USING (true);
CREATE POLICY "Admins manage plans" ON public.plans
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER plans_touch BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- USER SUBSCRIPTIONS (plan assignment)
-- ============================================================
CREATE TYPE public.subscription_status AS ENUM ('active', 'pending', 'suspended', 'cancelled');

CREATE TABLE public.user_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan_id       UUID REFERENCES public.plans(id) ON DELETE RESTRICT NOT NULL,
  status        subscription_status NOT NULL DEFAULT 'active',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ,                                -- NULL = no expiry (free forever)
  last_credit_refill_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes         TEXT,                                       -- admin notes
  assigned_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscription" ON public.user_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all subscriptions" ON public.user_subscriptions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER user_subscriptions_touch BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- CREDIT LEDGER
-- ============================================================
CREATE TYPE public.credit_tx_type AS ENUM (
  'plan_refill',        -- monthly auto-refill from plan
  'manual_topup',       -- admin manually adds credits
  'payment_approved',   -- credits from approved payment
  'ai_question_gen',    -- deduct: AI question generation
  'ai_image_scan',      -- deduct: OCR image scan
  'ai_interview',       -- deduct: AI interview (future)
  'ai_coding_test',     -- deduct: AI coding test (future)
  'extra_quiz',         -- deduct: extra quiz slot
  'extra_participants', -- deduct: extra participant slots
  'admin_adjustment',   -- admin manual correction
  'expiry'              -- credits expired
);

CREATE TABLE public.user_credits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance       INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_earned  INTEGER NOT NULL DEFAULT 0,
  total_spent   INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own credits" ON public.user_credits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all credits" ON public.user_credits
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.credit_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type        credit_tx_type NOT NULL,
  amount      INTEGER NOT NULL,                             -- positive = earned, negative = spent
  balance_after INTEGER NOT NULL,
  description TEXT,
  reference_id UUID,                                        -- payment_id, session_id, etc.
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON public.credit_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all transactions" ON public.credit_transactions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System inserts transactions" ON public.credit_transactions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_credit_tx_user ON public.credit_transactions(user_id, created_at DESC);

-- ============================================================
-- MANUAL PAYMENTS (screenshot-based)
-- ============================================================
CREATE TYPE public.payment_method AS ENUM ('easypaisa', 'jazzcash', 'bank_transfer', 'other');
CREATE TYPE public.payment_status AS ENUM ('pending', 'approved', 'rejected', 'refunded');

CREATE TABLE public.manual_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id         UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  amount_pkr      INTEGER NOT NULL,
  payment_method  payment_method NOT NULL,
  transaction_ref TEXT,                                     -- user's transaction ID / reference
  screenshot_url  TEXT NOT NULL,                            -- uploaded screenshot path
  status          payment_status NOT NULL DEFAULT 'pending',
  credits_to_add  INTEGER NOT NULL DEFAULT 0,               -- credits to give on approval
  notes           TEXT,                                     -- user notes
  admin_notes     TEXT,                                     -- admin notes on approval/rejection
  reviewed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own payments" ON public.manual_payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own payments" ON public.manual_payments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all payments" ON public.manual_payments
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER manual_payments_touch BEFORE UPDATE ON public.manual_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_manual_payments_user ON public.manual_payments(user_id, created_at DESC);
CREATE INDEX idx_manual_payments_status ON public.manual_payments(status, created_at DESC);

-- ============================================================
-- PAYMENT ACCOUNT SETTINGS (admin configures their accounts)
-- ============================================================
CREATE TABLE public.payment_accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method      payment_method NOT NULL UNIQUE,
  title       TEXT NOT NULL,                                -- e.g. "EasyPaisa"
  account_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  instructions TEXT,                                        -- shown to user when paying
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payment accounts publicly readable" ON public.payment_accounts
  FOR SELECT USING (true);
CREATE POLICY "Admins manage payment accounts" ON public.payment_accounts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- COMPANY PROFILES (Enterprise)
-- ============================================================
CREATE TYPE public.company_type AS ENUM (
  'school', 'university', 'college', 'training_center',
  'corporate', 'government', 'ngo', 'other'
);

CREATE TABLE public.company_profiles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_name      TEXT NOT NULL,
  company_type      company_type NOT NULL DEFAULT 'school',
  registration_no   TEXT,                                   -- company/school registration number
  website           TEXT,
  address           TEXT,
  city              TEXT,
  province          TEXT,
  country           TEXT NOT NULL DEFAULT 'Pakistan',
  phone             TEXT,
  email             TEXT,
  logo_url          TEXT,
  total_students    INTEGER,                                 -- approximate student count
  established_year  INTEGER,
  description       TEXT,
  is_verified       BOOLEAN NOT NULL DEFAULT FALSE,         -- admin verifies
  verified_at       TIMESTAMPTZ,
  verified_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company admin views own profile" ON public.company_profiles
  FOR SELECT TO authenticated USING (auth.uid() = admin_user_id);
CREATE POLICY "Company admin updates own profile" ON public.company_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = admin_user_id);
CREATE POLICY "Company admin inserts own profile" ON public.company_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = admin_user_id);
CREATE POLICY "Admins manage all companies" ON public.company_profiles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER company_profiles_touch BEFORE UPDATE ON public.company_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- COMPANY MEMBERS (Hosts / Teachers)
-- ============================================================
CREATE TYPE public.member_role AS ENUM ('admin', 'host', 'viewer');
CREATE TYPE public.member_status AS ENUM ('pending', 'active', 'suspended', 'removed');

CREATE TABLE public.company_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES public.company_profiles(id) ON DELETE CASCADE NOT NULL,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email   TEXT NOT NULL,
  role            member_role NOT NULL DEFAULT 'host',
  status          member_status NOT NULL DEFAULT 'pending',
  -- Professional details
  full_name       TEXT NOT NULL,
  department      TEXT,
  designation     TEXT,                                     -- e.g. "Senior Teacher", "HOD Physics"
  subject_area    TEXT,                                     -- subjects they teach
  employee_id     TEXT,                                     -- internal ID
  phone           TEXT,
  -- Metadata
  invite_token    TEXT UNIQUE,                              -- for email invite link
  invited_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company admin manages members" ON public.company_members
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.company_profiles cp
      WHERE cp.id = company_id AND cp.admin_user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_profiles cp
      WHERE cp.id = company_id AND cp.admin_user_id = auth.uid()
    )
  );
CREATE POLICY "Members view own record" ON public.company_members
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage all members" ON public.company_members
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER company_members_touch BEFORE UPDATE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_company_members_company ON public.company_members(company_id);
CREATE INDEX idx_company_members_user ON public.company_members(user_id);

-- Hosts can view their company profile (defined here because it references company_members)
CREATE POLICY "Company members view profile" ON public.company_profiles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = id AND cm.user_id = auth.uid() AND cm.status = 'active'
    )
  );

-- ============================================================
-- SEED: DEFAULT PLANS
-- ============================================================
INSERT INTO public.plans (slug, tier, name, description, price_pkr, credits_per_month,
  quizzes_per_day, participants_per_session, participants_total, question_bank, sessions_total,
  max_hosts, ai_calls_per_day, ai_enabled, custom_branding, white_label,
  credit_cost_ai_10q, credit_cost_ai_scan, credit_cost_ai_interview, credit_cost_ai_coding,
  credit_cost_extra_quiz, credit_cost_extra_participants,
  sort_order, features_list)
VALUES
-- INDIVIDUAL STARTER (Free)
('individual_starter', 'individual', 'Starter', 'Perfect for trying out the platform',
  0, 0,
  3, 50, 50, 50, -1,
  0, 0, FALSE, FALSE, FALSE,
  3, 2, 5, 5, 1, 1,
  1, ARRAY[
    '3 quizzes per day',
    '50 questions in bank',
    '50 participants stored',
    '50 participants per session',
    'MCQ question type',
    'Basic analytics'
  ]),

-- INDIVIDUAL PRO
('individual_pro', 'individual', 'Pro', 'For active teachers and educators',
  499, 250,
  20, 200, 500, 500, -1,
  0, -1, TRUE, TRUE, FALSE,
  3, 2, 5, 5, 1, 1,
  2, ARRAY[
    '250 credits per month included',
    '20 quizzes per day',
    '500 questions in bank',
    '500 participants stored',
    '200 participants per session',
    'Unlimited AI generation',
    'Image OCR scanning',
    'Custom branding',
    'Advanced analytics',
    'All question types'
  ]),

-- INDIVIDUAL PRO PLUS
('individual_pro_plus', 'individual', 'Pro Plus', 'For power users and institutions',
  999, 700,
  -1, 500, 2000, -1, -1,
  0, -1, TRUE, TRUE, TRUE,
  3, 2, 5, 5, 1, 1,
  3, ARRAY[
    '700 credits per month included',
    'Unlimited quizzes per day',
    'Unlimited question bank',
    '2000 participants stored',
    '500 participants per session',
    'Unlimited AI generation',
    'AI Interview (coming soon)',
    'AI Coding Tests (coming soon)',
    'White label branding',
    'Priority support',
    'Full analytics & exports'
  ]),

-- ENTERPRISE STARTER (Free)
('enterprise_starter', 'enterprise', 'Org Starter', 'Get your organization started',
  0, 0,
  5, 100, 200, 200, -1,
  3, 1, TRUE, FALSE, FALSE,
  3, 2, 5, 5, 1, 1,
  4, ARRAY[
    '1 admin + 3 hosts/teachers',
    '200 students stored',
    '100 students per session',
    '1 AI call per day',
    'School-wide analytics',
    'Bulk participant import'
  ]),

-- ENTERPRISE PRO
('enterprise_pro', 'enterprise', 'Org Pro', 'For growing schools and organizations',
  1999, 1500,
  -1, 500, 2000, -1, -1,
  20, -1, TRUE, TRUE, FALSE,
  3, 2, 5, 5, 1, 1,
  5, ARRAY[
    '1500 credits per month included',
    '1 admin + 20 hosts/teachers',
    '2000 students stored',
    '500 students per session',
    'Unlimited AI generation',
    'Full school + teacher analytics',
    'Custom branding',
    'Bulk data export',
    'AI Interview (coming soon)'
  ]),

-- ENTERPRISE ELITE
('enterprise_elite', 'enterprise', 'Org Elite', 'For large institutions and districts',
  4999, 5000,
  -1, -1, -1, -1, -1,
  -1, -1, TRUE, TRUE, TRUE,
  3, 2, 5, 5, 1, 1,
  6, ARRAY[
    '5000 credits per month included',
    'Unlimited hosts/teachers',
    'Unlimited students',
    'Unlimited participants per session',
    'Unlimited AI generation',
    'White label + custom domain',
    'District-level analytics',
    'AI Interview & Coding Tests (coming soon)',
    'Dedicated account manager',
    'Priority 24/7 support',
    'Custom integrations'
  ]);

-- ============================================================
-- SEED: PAYMENT ACCOUNTS (admin will update with real numbers)
-- ============================================================
INSERT INTO public.payment_accounts (method, title, account_name, account_number, instructions)
VALUES
  ('easypaisa', 'EasyPaisa', 'EvaluTease', '0300-0000000',
   'Send payment to this EasyPaisa account, then upload screenshot below.'),
  ('jazzcash', 'JazzCash', 'EvaluTease', '0300-0000000',
   'Send payment to this JazzCash account, then upload screenshot below.'),
  ('bank_transfer', 'Bank Transfer', 'EvaluTease Pvt Ltd',
   'HBL | Account: 00000000000 | IBAN: PK00HABB0000000000000000',
   'Transfer to this bank account and upload transfer receipt below.');

-- ============================================================
-- FUNCTION: Assign free plan on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_starter_plan()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  SELECT id INTO v_plan_id FROM public.plans WHERE slug = 'individual_starter' LIMIT 1;
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status)
    VALUES (NEW.id, v_plan_id, 'active')
    ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.user_credits (user_id, balance) VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Replace old trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_plan ON auth.users;
CREATE TRIGGER on_auth_user_plan
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_starter_plan();

-- ============================================================
-- FUNCTION: Deduct credits safely (returns false if insufficient)
-- ============================================================
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_type credit_tx_type,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  SELECT balance INTO v_balance FROM public.user_credits WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN FALSE;
  END IF;
  v_new_balance := v_balance - p_amount;
  UPDATE public.user_credits
    SET balance = v_new_balance, total_spent = total_spent + p_amount, updated_at = now()
    WHERE user_id = p_user_id;
  INSERT INTO public.credit_transactions (user_id, type, amount, balance_after, description, reference_id)
    VALUES (p_user_id, p_type, -p_amount, v_new_balance, p_description, p_reference_id);
  RETURN TRUE;
END;
$$;

-- ============================================================
-- FUNCTION: Add credits
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_type credit_tx_type,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  INSERT INTO public.user_credits (user_id, balance, total_earned)
    VALUES (p_user_id, p_amount, p_amount)
    ON CONFLICT (user_id) DO UPDATE
    SET balance = user_credits.balance + p_amount,
        total_earned = user_credits.total_earned + p_amount,
        updated_at = now()
    RETURNING balance INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    SELECT balance INTO v_new_balance FROM public.user_credits WHERE user_id = p_user_id;
  END IF;

  INSERT INTO public.credit_transactions
    (user_id, type, amount, balance_after, description, reference_id, performed_by)
    VALUES (p_user_id, p_type, p_amount, v_new_balance, p_description, p_reference_id, p_performed_by);
END;
$$;

-- ============================================================
-- FUNCTION: Approve payment and add credits + update plan
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_payment(
  p_payment_id UUID,
  p_admin_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment public.manual_payments;
BEGIN
  SELECT * INTO v_payment FROM public.manual_payments WHERE id = p_payment_id;
  IF v_payment IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_payment.status != 'pending' THEN RAISE EXCEPTION 'Payment already processed'; END IF;

  -- Add credits
  PERFORM public.add_credits(
    v_payment.user_id, v_payment.credits_to_add,
    'payment_approved', 'Payment approved: ' || v_payment.amount_pkr || ' PKR',
    p_payment_id, p_admin_id
  );

  -- Update plan if specified
  IF v_payment.plan_id IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status, assigned_by)
      VALUES (v_payment.user_id, v_payment.plan_id, 'active', p_admin_id)
      ON CONFLICT (user_id) DO UPDATE
      SET plan_id = v_payment.plan_id, status = 'active',
          assigned_by = p_admin_id, updated_at = now();
  END IF;

  -- Mark payment approved
  UPDATE public.manual_payments
    SET status = 'approved', reviewed_by = p_admin_id,
        reviewed_at = now(), admin_notes = p_admin_notes, updated_at = now()
    WHERE id = p_payment_id;
END;
$$;

-- Indexes
CREATE INDEX idx_user_subscriptions_user ON public.user_subscriptions(user_id);
CREATE INDEX idx_user_credits_user ON public.user_credits(user_id);
CREATE INDEX idx_company_profiles_admin ON public.company_profiles(admin_user_id);
