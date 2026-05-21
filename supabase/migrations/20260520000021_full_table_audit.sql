-- ============================================================
-- Full-coverage CRUD audit
-- Attaches public.trg_generic_audit() to every remaining
-- user-facing or owner-relevant table so that *every* DB write
-- produces an activity_logs row, per user request.
--
-- ─── Still NOT attached (would cause harm) ─────────────────
--   * activity_logs       → recursive: would log itself forever
--   * notifications       → system table, every trigger above fires
--                            many notifications → 1 user action could
--                            create 5+ log rows; pure spam
--   * security_alerts     → derived from other triggers, no source
--                            user action; would double-log
--   * ai_usage_logs       → derived from server-side audit.server.ts;
--                            the source AI call is already logged
--   * trial_ai_usage      → system counter, no user-facing meaning
--   * rate_limit_ledger   → potentially hundreds of writes/sec;
--                            logging it would crash the DB
--
-- ⚠ VOLUME WARNING:
-- Attaching generic INSERT triggers to quiz_answers and
-- quiz_session_* tables will write one activity_logs row per
-- answer / per assigned question / per assigned participant.
-- For a 50-person × 20-question quiz that is ~2,000 extra rows
-- per session. Acceptable per your request, but monitor table
-- growth and consider periodic archival of old activity_logs.
-- ============================================================

-- ─── Tables previously skipped for "already covered" reasons.
-- We attach generic but limit to the ops that the specific trigger
-- does NOT already log, to avoid double-rows.

-- quiz_sessions: specific covers INSERT, DELETE, and meaningful UPDATEs
-- (status / paused_at / scheduled_at / reminder_sent). Generic on UPDATE
-- would duplicate those. Skip — full coverage exists.

-- quiz_attempts: specific covers INSERT and UPDATE→completed.
-- Add generic for DELETE so removals are caught.
DROP TRIGGER IF EXISTS aa_audit_generic ON public.quiz_attempts;
CREATE TRIGGER aa_audit_generic
  AFTER DELETE ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('sessions');

-- quiz_answers: specific covers UPDATE→graded only.
-- Add generic for INSERT and DELETE so submission/removal are caught.
-- ⚠ INSERT volume during live quizzes; intentional per request.
DROP TRIGGER IF EXISTS aa_audit_generic ON public.quiz_answers;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR DELETE ON public.quiz_answers
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('grading');

-- manual_payments / user_subscriptions / credit_transactions /
-- app_feedback: specific triggers handle INSERT and meaningful UPDATEs.
-- Add generic for DELETE only.
DROP TRIGGER IF EXISTS aa_audit_generic ON public.manual_payments;
CREATE TRIGGER aa_audit_generic
  AFTER DELETE ON public.manual_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('billing');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.user_subscriptions;
CREATE TRIGGER aa_audit_generic
  AFTER DELETE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('billing');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.credit_transactions;
CREATE TRIGGER aa_audit_generic
  AFTER DELETE ON public.credit_transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('billing');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.app_feedback;
CREATE TRIGGER aa_audit_generic
  AFTER DELETE ON public.app_feedback
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('feedback');

-- ─── Tables previously skipped as "bulk noise"; now attached
--     fully per request.

DROP TRIGGER IF EXISTS aa_audit_generic ON public.quiz_session_questions;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.quiz_session_questions
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('sessions');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.quiz_session_participants;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.quiz_session_participants
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('sessions');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.quiz_session_subtypes;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.quiz_session_subtypes
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('sessions');

DROP TRIGGER IF EXISTS aa_audit_generic ON public.participant_group_members;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.participant_group_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('participants');

-- ─── System-derived tables: previously skipped as "noise / derived".
--     Now attached per request (except the six explicitly listed at top).

-- profiles: INSERT comes from the signup trigger and is already logged
-- client-side. Generic catches UPDATE (profile edits) and DELETE.
DROP TRIGGER IF EXISTS aa_audit_generic ON public.profiles;
CREATE TRIGGER aa_audit_generic
  AFTER UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('account');

-- user_credits: UPDATE = balance changes. INSERT = initial row creation.
DROP TRIGGER IF EXISTS aa_audit_generic ON public.user_credits;
CREATE TRIGGER aa_audit_generic
  AFTER INSERT OR UPDATE OR DELETE ON public.user_credits
  FOR EACH ROW EXECUTE FUNCTION public.trg_generic_audit('billing');
