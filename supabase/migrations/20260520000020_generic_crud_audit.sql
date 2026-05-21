-- ============================================================
-- Generic CRUD audit
-- One reusable trigger function that logs every INSERT / UPDATE /
-- DELETE on every meaningful user-facing public table.
--
-- Tables explicitly NOT attached (with reasons):
--   * quiz_sessions, quiz_attempts, quiz_answers (UPDATE-graded),
--     manual_payments, user_subscriptions, credit_transactions,
--     app_feedback  → already have specific triggers in migrations 18 & 19
--   * quiz_answers INSERT, quiz_session_questions,
--     quiz_session_participants, quiz_session_subtypes,
--     participant_group_members → high-volume bulk writes
--     (one row per question per participant). The meaningful unit
--     of work is already logged at the parent-entity level.
--   * activity_logs → would recurse infinitely
--   * notifications, security_alerts, ai_usage_logs,
--     trial_ai_usage, rate_limit_ledger, user_credits, profiles
--     → system / system-derived tables; the source events that
--     cause writes here are already logged elsewhere.
-- ============================================================

-- ─── Generic trigger function ─────────────────────────────────
-- Pass module name as the trigger argument so the log row carries
-- a friendly module label (e.g. "questions", "billing").
CREATE OR REPLACE FUNCTION public.trg_generic_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row    JSONB := CASE TG_OP WHEN 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_module TEXT  := COALESCE(TG_ARGV[0], 'system');
  v_action TEXT;
  v_label  TEXT;
  v_owner  UUID;
  v_id     UUID;
  v_risk   INTEGER;
BEGIN
  v_action := CASE TG_OP
    WHEN 'INSERT' THEN 'created'
    WHEN 'UPDATE' THEN 'updated'
    WHEN 'DELETE' THEN 'deleted'
  END;

  -- Best-effort friendly label from common columns
  v_label := COALESCE(
    v_row->>'name',
    v_row->>'title',
    v_row->>'label',
    v_row->>'email',
    v_row->>'access_code',
    v_row->>'code',
    v_row->>'token',
    v_row->>'id'
  );

  -- Resolve "who owns this row" so the log appears in their feed
  v_owner := COALESCE(
    NULLIF(v_row->>'owner_id',      '')::UUID,
    NULLIF(v_row->>'user_id',       '')::UUID,
    NULLIF(v_row->>'plan_owner_id', '')::UUID,
    NULLIF(v_row->>'admin_user_id', '')::UUID,
    auth.uid()
  );

  v_id := NULLIF(v_row->>'id', '')::UUID;

  -- Risk: deletes are noisier, updates on admin-only tables (handled by caller) can override via specific triggers
  v_risk := CASE TG_OP WHEN 'DELETE' THEN 30 ELSE 5 END;

  PERFORM public._log_app_activity(
    v_action,
    v_module,
    TG_TABLE_NAME,
    v_id,
    left(v_label, 240),
    v_owner,
    initcap(v_action) || ' ' || replace(TG_TABLE_NAME, '_', ' ')
      || CASE WHEN v_label IS NOT NULL AND v_label <> COALESCE(v_id::TEXT, '')
              THEN ' "' || v_label || '"'
              ELSE '' END,
    jsonb_build_object('op', TG_OP, 'table', TG_TABLE_NAME),
    v_risk
  );

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- ─── Convenience macro: attach the generic trigger to a table ─
-- (Plain repeated DDL — Postgres has no inline macro, but the pattern
--  is easy to scan: drop-if-exists, then create.)

-- ─── Question bank ────────────────────────────────────────────
DROP TRIGGER IF EXISTS aa_audit_generic ON public.questions;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('questions');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.question_categories;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.question_categories
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('questions');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.question_subcategories;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.question_subcategories
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('questions');

-- ─── Participants ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS aa_audit_generic ON public.participants;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('participants');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.participant_types;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.participant_types
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('participants');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.participant_subtypes;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.participant_subtypes
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('participants');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.participant_groups;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.participant_groups
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('participants');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.participant_invites;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.participant_invites
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('participants');

-- ─── Organisation / hosts ─────────────────────────────────────
DROP TRIGGER IF EXISTS aa_audit_generic ON public.company_members;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('company');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.company_profiles;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.company_profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('company');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.host_settings;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.host_settings
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('settings');

-- ─── Admin-managed tables ─────────────────────────────────────
DROP TRIGGER IF EXISTS aa_audit_generic ON public.plans;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('admin');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.payment_accounts;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('admin');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.credit_packages;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.credit_packages
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('admin');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.credit_requests;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.credit_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('billing');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.blocked_email_domains;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.blocked_email_domains
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('admin');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.user_roles;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('admin');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.ai_model_pricing;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.ai_model_pricing
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('admin');

-- ─── app_feedback: add UPDATE/DELETE generic; INSERT already covered ──
-- The specific trigger trg_app_feedback_audit handles INSERT (with
-- richer message and priority detail). Generic trigger fires for all
-- ops too, but inserts will only show the bland "created app feedback"
-- message — we'd have a duplicate row. To avoid duplication, we DON'T
-- attach the generic trigger to app_feedback at all; the specific one
-- already covers what we need.

-- ─── Promo codes (conditional — only if table exists) ─────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promo_codes') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS aa_audit_generic ON public.promo_codes';
    EXECUTE 'CREATE TRIGGER aa_audit_generic
      AFTER INSERT OR UPDATE OR DELETE ON public.promo_codes
      FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit(''billing'')';
  END IF;
END
$$;
