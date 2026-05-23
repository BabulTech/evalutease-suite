-- ============================================================
-- Performance indexes: cover every hot query path not already
-- indexed by earlier migrations (hardening + pagination).
-- All are CREATE INDEX IF NOT EXISTS — safe to re-run.
-- ============================================================

-- ─── user_subscriptions ──────────────────────────────────────
-- usePlanLoader: .eq("user_id").eq("status", "active")
-- plan.server.ts: same pattern, called on every server request
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status
  ON public.user_subscriptions(user_id, status);

-- ─── user_credits ─────────────────────────────────────────────
-- usePlanLoader: .eq("user_id") — 1:1 lookup called every page load
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_credits_user
  ON public.user_credits(user_id);

-- ─── notifications ─────────────────────────────────────────────
-- NotificationContext: .eq("user_id").order("created_at", desc)
-- Mark-read: .eq("user_id").eq("read", false) for badge count
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications(user_id, read, created_at DESC);

-- ─── questions ─────────────────────────────────────────────────
-- usePlanLoader counts: .eq("owner_id")
-- CategoryPanel / QuestionList: .eq("owner_id").eq("category_id")
CREATE INDEX IF NOT EXISTS idx_questions_owner_created
  ON public.questions(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_questions_owner_category
  ON public.questions(owner_id, category_id)
  WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_owner_subcategory
  ON public.questions(owner_id, subcategory_id)
  WHERE subcategory_id IS NOT NULL;

-- ─── question_categories ───────────────────────────────────────
-- CategoryGrid: .eq("owner_id").order("created_at")
CREATE INDEX IF NOT EXISTS idx_question_categories_owner
  ON public.question_categories(owner_id, created_at DESC);

-- ─── question_subcategories ────────────────────────────────────
-- SubCategoryGrid: .eq("owner_id").eq("category_id")
CREATE INDEX IF NOT EXISTS idx_question_subcategories_owner_category
  ON public.question_subcategories(owner_id, category_id);

-- ─── participant_types ─────────────────────────────────────────
-- TypeGrid: .eq("owner_id")
CREATE INDEX IF NOT EXISTS idx_participant_types_owner
  ON public.participant_types(owner_id, created_at DESC);

-- ─── participant_subtypes ──────────────────────────────────────
-- SubTypeGrid: .eq("owner_id").eq("type_id")
CREATE INDEX IF NOT EXISTS idx_participant_subtypes_owner_type
  ON public.participant_subtypes(owner_id, type_id);

-- ─── participant_invites ───────────────────────────────────────
-- Join path: .eq("token", ...) — must be O(1)
CREATE UNIQUE INDEX IF NOT EXISTS uq_participant_invites_token
  ON public.participant_invites(token);

-- Host management: .eq("owner_id").eq("status")
CREATE INDEX IF NOT EXISTS idx_participant_invites_owner_status
  ON public.participant_invites(owner_id, status);

-- ─── participant_groups ────────────────────────────────────────
-- .eq("owner_id")
CREATE INDEX IF NOT EXISTS idx_participant_groups_owner
  ON public.participant_groups(owner_id);

-- participant_group_members: reverse FK (group→members already has FK index;
-- need participant→groups for participant drill-down)
CREATE INDEX IF NOT EXISTS idx_pgm_participant
  ON public.participant_group_members(participant_id);

-- ─── activity_logs ─────────────────────────────────────────────
-- get_my_recent_activity: WHERE plan_owner_id = uid ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_activity_logs_owner_created
  ON public.activity_logs(plan_owner_id, created_at DESC)
  WHERE plan_owner_id IS NOT NULL;

-- get_session_activity: WHERE entity_type='quiz_session' AND entity_id=...
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity
  ON public.activity_logs(entity_type, entity_id, created_at DESC)
  WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;

-- Admin activity log section: filter by module / action_type
CREATE INDEX IF NOT EXISTS idx_activity_logs_module_created
  ON public.activity_logs(module, created_at DESC);

-- ─── ai_usage_logs ─────────────────────────────────────────────
-- Admin AI usage: .order("created_at", desc).eq("feature")
-- Plan owner view: WHERE plan_owner_id = uid
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_owner_created
  ON public.ai_usage_logs(plan_owner_id, created_at DESC)
  WHERE plan_owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_feature_created
  ON public.ai_usage_logs(feature, created_at DESC);

-- ─── security_alerts ───────────────────────────────────────────
-- Admin: .eq("status").order("created_at", desc)
CREATE INDEX IF NOT EXISTS idx_security_alerts_status_created
  ON public.security_alerts(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_alerts_owner_created
  ON public.security_alerts(plan_owner_id, created_at DESC)
  WHERE plan_owner_id IS NOT NULL;

-- ─── manual_payments ───────────────────────────────────────────
-- Billing view: .eq("user_id").order("created_at", desc)
-- Admin finance: filter by status
CREATE INDEX IF NOT EXISTS idx_manual_payments_user_created
  ON public.manual_payments(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_manual_payments_status_created
  ON public.manual_payments(status, created_at DESC);

-- ─── credit_transactions ───────────────────────────────────────
-- CreditsSection: .eq("user_id").order("created_at", desc)
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created
  ON public.credit_transactions(user_id, created_at DESC);

-- ─── credit_requests ───────────────────────────────────────────
-- AppSidebar badge: .eq("status", "pending").eq("company_id")
-- HostBillingView: .eq("company_id")
CREATE INDEX IF NOT EXISTS idx_credit_requests_company_status
  ON public.credit_requests(company_id, status);

CREATE INDEX IF NOT EXISTS idx_credit_requests_requester
  ON public.credit_requests(requester_user_id, created_at DESC);

-- ─── company_members ───────────────────────────────────────────
-- plan.server.ts: .eq("user_id").eq("status", "active")
CREATE INDEX IF NOT EXISTS idx_company_members_user_status
  ON public.company_members(user_id, status)
  WHERE user_id IS NOT NULL;

-- Company admin: .eq("company_id")
CREATE INDEX IF NOT EXISTS idx_company_members_company_status
  ON public.company_members(company_id, status);

-- ─── company_profiles ──────────────────────────────────────────
-- Dashboard: .eq("admin_user_id")
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_profiles_admin
  ON public.company_profiles(admin_user_id);

-- ─── user_roles ────────────────────────────────────────────────
-- AppSidebar + admin guard: .eq("user_id").eq("role", "admin")
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role
  ON public.user_roles(user_id, role);

-- ─── quiz_feedback ─────────────────────────────────────────────
-- ReviewsSection: JOIN with quiz_sessions; feedback per session
CREATE INDEX IF NOT EXISTS idx_quiz_feedback_session_submitted
  ON public.quiz_feedback(session_id, submitted_at DESC);

-- ─── trial_ai_usage ────────────────────────────────────────────
-- plan.server.ts: .eq("user_id") — 1:1 lookup
CREATE UNIQUE INDEX IF NOT EXISTS uq_trial_ai_usage_user
  ON public.trial_ai_usage(user_id);

-- ─── rate_limit_ledger ─────────────────────────────────────────
-- Rate-limit check: WHERE identifier=? AND bucket=? AND window_start=?
-- This is the hottest write path — one row per request window
CREATE UNIQUE INDEX IF NOT EXISTS uq_rate_limit_ledger
  ON public.rate_limit_ledger(identifier, bucket, window_start);

-- ─── app_feedback ──────────────────────────────────────────────
-- Admin: .eq("status").order("created_at", desc)
CREATE INDEX IF NOT EXISTS idx_app_feedback_status_created
  ON public.app_feedback(status, created_at DESC);

-- ─── plans ─────────────────────────────────────────────────────
-- Subscription lookup: .eq("slug").eq("is_active", true)
-- Already has PK on id; slug + is_active is a common filter
CREATE INDEX IF NOT EXISTS idx_plans_slug_active
  ON public.plans(slug, is_active)
  WHERE is_active = TRUE;

-- ─── org tables ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_org_departments_org
  ON public.org_departments(org_id, is_active);

CREATE INDEX IF NOT EXISTS idx_org_invites_org_status
  ON public.org_invites(org_id, status);

CREATE INDEX IF NOT EXISTS idx_org_invites_token
  ON public.org_invites(token);

-- ─── Update planner statistics ─────────────────────────────────
ANALYZE public.user_subscriptions;
ANALYZE public.user_credits;
ANALYZE public.notifications;
ANALYZE public.questions;
ANALYZE public.question_categories;
ANALYZE public.question_subcategories;
ANALYZE public.participant_types;
ANALYZE public.participant_subtypes;
ANALYZE public.participant_invites;
ANALYZE public.activity_logs;
ANALYZE public.ai_usage_logs;
ANALYZE public.security_alerts;
ANALYZE public.manual_payments;
ANALYZE public.credit_transactions;
ANALYZE public.credit_requests;
ANALYZE public.company_members;
ANALYZE public.company_profiles;
ANALYZE public.user_roles;
ANALYZE public.quiz_feedback;
ANALYZE public.rate_limit_ledger;

NOTIFY pgrst, 'reload schema';
