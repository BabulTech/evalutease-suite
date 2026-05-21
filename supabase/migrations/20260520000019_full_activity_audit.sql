-- ============================================================
-- App-wide activity audit + notifications
-- Triggers on: quiz_answers (grading), quiz_attempts (participant
-- lifecycle), manual_payments, app_feedback, user_subscriptions,
-- credit_transactions. Also adds get_my_recent_activity RPC and
-- broadens the "owners read own activity" RLS policy.
-- ============================================================

-- ─── Generic helper: insert into activity_logs ──────────────
CREATE OR REPLACE FUNCTION public._log_app_activity(
  p_action_type   TEXT,
  p_module        TEXT,
  p_entity_type   TEXT,
  p_entity_id     UUID,
  p_entity_label  TEXT,
  p_plan_owner_id UUID,
  p_message       TEXT,
  p_details       JSONB DEFAULT '{}'::jsonb,
  p_risk_score    INTEGER DEFAULT 0
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor   UUID := COALESCE(auth.uid(), p_plan_owner_id);
  v_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_actor;

  INSERT INTO public.activity_logs (
    actor_user_id, actor_name, actor_email, plan_owner_id,
    action_type, module, entity_type, entity_id, entity_label,
    message, details, risk_score
  ) VALUES (
    v_actor,
    COALESCE(v_profile.full_name, split_part(COALESCE(v_profile.email, ''), '@', 1), 'System'),
    v_profile.email,
    p_plan_owner_id,
    left(lower(trim(p_action_type)), 50),
    left(lower(trim(p_module)), 50),
    NULLIF(left(trim(COALESCE(p_entity_type, '')), 50), ''),
    p_entity_id,
    NULLIF(left(trim(COALESCE(p_entity_label, '')), 240), ''),
    COALESCE(NULLIF(trim(p_message), ''), 'Activity recorded'),
    COALESCE(p_details, '{}'::jsonb),
    GREATEST(0, LEAST(100, COALESCE(p_risk_score, 0)))
  );
END;
$$;

-- ============================================================
-- A. quiz_answers — single answer grading + attempt-complete notify
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_quiz_answer_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session  public.quiz_sessions%ROWTYPE;
  v_attempt  public.quiz_attempts%ROWTYPE;
  v_q_type   TEXT;
  v_pending  INTEGER;
BEGIN
  -- Only react when an answer is freshly graded
  IF OLD.graded_at IS NULL AND NEW.graded_at IS NOT NULL THEN
    SELECT * INTO v_attempt FROM public.quiz_attempts WHERE id = NEW.attempt_id;
    IF v_attempt.id IS NULL THEN RETURN NEW; END IF;
    SELECT * INTO v_session FROM public.quiz_sessions WHERE id = v_attempt.session_id;
    SELECT q.type::TEXT INTO v_q_type FROM public.questions q WHERE q.id = NEW.question_id;

    -- Single-grade log row
    PERFORM public._log_app_activity(
      'graded', 'grading', 'quiz_answer', NEW.id,
      COALESCE(v_session.title, 'session'),
      v_session.owner_id,
      'Graded ' || COALESCE(v_q_type, 'answer') || ' (' || COALESCE(NEW.points_awarded::TEXT, '0')
        || ' pts) for ' || COALESCE(v_attempt.participant_name, 'a participant'),
      jsonb_build_object(
        'session_id',    v_session.id,
        'attempt_id',    NEW.attempt_id,
        'question_type', v_q_type,
        'points',        NEW.points_awarded
      ),
      0
    );

    -- If this attempt has no more typed-answer rows pending, notify host
    SELECT count(*) INTO v_pending
    FROM public.quiz_answers qa
    JOIN public.questions q ON q.id = qa.question_id
    WHERE qa.attempt_id = NEW.attempt_id
      AND qa.graded_at IS NULL
      AND q.type IN ('short_answer', 'long_answer');

    IF v_pending = 0 AND v_attempt.completed = TRUE THEN
      PERFORM public.create_notification(
        v_session.owner_id,
        'All answers graded',
        COALESCE(v_attempt.participant_name, 'A participant')
          || '''s answers in "' || v_session.title || '" are fully graded.',
        'success',
        '/sessions/' || v_session.id::text
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_quiz_answer_audit ON public.quiz_answers;
CREATE TRIGGER on_quiz_answer_audit
  AFTER UPDATE ON public.quiz_answers
  FOR EACH ROW EXECUTE FUNCTION public.trg_quiz_answer_audit();

-- ============================================================
-- B. quiz_attempts — participant join / submit
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_quiz_attempt_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_session public.quiz_sessions%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_session FROM public.quiz_sessions WHERE id = NEW.session_id;
    IF v_session.id IS NULL THEN RETURN NEW; END IF;
    PERFORM public._log_app_activity(
      'joined', 'sessions', 'quiz_attempt', NEW.id,
      v_session.title,
      v_session.owner_id,
      COALESCE(NEW.participant_name, 'A participant') || ' joined "' || v_session.title || '"',
      jsonb_build_object(
        'session_id',        v_session.id,
        'participant_email', NEW.participant_email
      ),
      0
    );
    -- No notification on join (would spam for live quizzes)
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND COALESCE(NEW.completed, false) = TRUE
     AND COALESCE(OLD.completed, false) = FALSE THEN
    SELECT * INTO v_session FROM public.quiz_sessions WHERE id = NEW.session_id;
    IF v_session.id IS NULL THEN RETURN NEW; END IF;
    PERFORM public._log_app_activity(
      'submitted', 'sessions', 'quiz_attempt', NEW.id,
      v_session.title,
      v_session.owner_id,
      COALESCE(NEW.participant_name, 'A participant') || ' submitted "' || v_session.title
        || '" (' || NEW.score || '/' || NEW.total_questions || ')',
      jsonb_build_object(
        'session_id',  v_session.id,
        'score',       NEW.score,
        'total',       NEW.total_questions
      ),
      0
    );
    PERFORM public.create_notification(
      v_session.owner_id,
      'Participant submitted',
      COALESCE(NEW.participant_name, 'A participant') || ' finished "' || v_session.title
        || '" — ' || NEW.score || '/' || NEW.total_questions || '.',
      'info',
      '/sessions/' || v_session.id::text
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_quiz_attempt_audit ON public.quiz_attempts;
CREATE TRIGGER on_quiz_attempt_audit
  AFTER INSERT OR UPDATE ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.trg_quiz_attempt_audit();

-- ============================================================
-- C. manual_payments — submission, approval, rejection
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_manual_payment_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action TEXT;
  v_msg    TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._log_app_activity(
      'submitted', 'billing', 'manual_payment', NEW.id,
      'PKR ' || NEW.amount_pkr,
      NEW.user_id,
      'Submitted manual payment of PKR ' || NEW.amount_pkr || ' via ' || NEW.payment_method,
      jsonb_build_object(
        'amount_pkr',     NEW.amount_pkr,
        'method',         NEW.payment_method,
        'credits_to_add', NEW.credits_to_add
      ),
      10
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      v_action := 'approved';
      v_msg    := 'Payment approved — credited ' || NEW.credits_to_add || ' credits';
    ELSIF NEW.status = 'rejected' THEN
      v_action := 'rejected';
      v_msg    := 'Payment rejected: ' || COALESCE(NEW.admin_notes, 'no reason given');
    ELSE
      v_action := 'status_changed';
      v_msg    := 'Payment status: ' || OLD.status || ' → ' || NEW.status;
    END IF;

    PERFORM public._log_app_activity(
      v_action, 'billing', 'manual_payment', NEW.id,
      'PKR ' || NEW.amount_pkr,
      NEW.user_id,
      v_msg,
      jsonb_build_object(
        'from',        OLD.status,
        'to',          NEW.status,
        'admin_notes', NEW.admin_notes
      ),
      CASE WHEN NEW.status = 'rejected' THEN 30 ELSE 20 END
    );

    -- The pre-existing notify_payment_approved trigger handles the 'approved' case.
    -- We only add a 'rejected' notification here.
    IF NEW.status = 'rejected' THEN
      PERFORM public.create_notification(
        NEW.user_id,
        'Payment rejected',
        'Your payment of PKR ' || NEW.amount_pkr || ' was rejected. '
          || COALESCE(NEW.admin_notes, 'Please check Billing for details.'),
        'error',
        '/billing'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_manual_payment_audit ON public.manual_payments;
CREATE TRIGGER on_manual_payment_audit
  AFTER INSERT OR UPDATE ON public.manual_payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_manual_payment_audit();

-- ============================================================
-- D. app_feedback — submission + admin reply
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_app_feedback_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public._log_app_activity(
      'submitted', 'feedback', 'app_feedback', NEW.id,
      NEW.title, NEW.user_id,
      'Submitted feedback: ' || NEW.title,
      jsonb_build_object('type', NEW.type, 'priority', NEW.priority),
      5
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND COALESCE(NEW.admin_reply, '') <> COALESCE(OLD.admin_reply, '')
     AND NEW.admin_reply IS NOT NULL
     AND length(trim(NEW.admin_reply)) > 0 THEN
    PERFORM public._log_app_activity(
      'replied', 'feedback', 'app_feedback', NEW.id,
      NEW.title, NEW.user_id,
      'Admin replied to feedback: ' || NEW.title,
      jsonb_build_object('reply_preview', left(NEW.admin_reply, 200), 'status', NEW.status),
      10
    );
    PERFORM public.create_notification(
      NEW.user_id,
      'Admin replied to your feedback',
      'Your feedback "' || NEW.title || '" has a new reply from the team.',
      'info',
      '/settings'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_app_feedback_audit ON public.app_feedback;
CREATE TRIGGER on_app_feedback_audit
  AFTER INSERT OR UPDATE ON public.app_feedback
  FOR EACH ROW EXECUTE FUNCTION public.trg_app_feedback_audit();

-- ============================================================
-- E. user_subscriptions — plan upgrade / downgrade
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_subscription_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old_plan TEXT;
  v_new_plan TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT name INTO v_new_plan FROM public.plans WHERE id = NEW.plan_id;
    PERFORM public._log_app_activity(
      'subscribed', 'billing', 'subscription', NEW.id,
      v_new_plan, NEW.user_id,
      'Subscribed to ' || COALESCE(v_new_plan, 'a plan'),
      jsonb_build_object('plan_id', NEW.plan_id, 'expires_at', NEW.expires_at),
      10
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
    SELECT name INTO v_old_plan FROM public.plans WHERE id = OLD.plan_id;
    SELECT name INTO v_new_plan FROM public.plans WHERE id = NEW.plan_id;
    PERFORM public._log_app_activity(
      'plan_changed', 'billing', 'subscription', NEW.id,
      v_new_plan, NEW.user_id,
      'Plan changed: ' || COALESCE(v_old_plan, 'unknown') || ' → ' || COALESCE(v_new_plan, 'unknown'),
      jsonb_build_object('from_plan', v_old_plan, 'to_plan', v_new_plan),
      15
    );
    PERFORM public.create_notification(
      NEW.user_id,
      'Your plan was updated',
      'You are now on the "' || COALESCE(v_new_plan, 'new') || '" plan.',
      'success',
      '/billing'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_subscription_audit ON public.user_subscriptions;
CREATE TRIGGER on_subscription_audit
  AFTER INSERT OR UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trg_subscription_audit();

-- ============================================================
-- F. credit_transactions — every credit movement + low-balance warning
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_credit_tx_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action TEXT;
  v_msg    TEXT;
  v_prev_balance INTEGER;
BEGIN
  IF NEW.amount > 0 THEN
    v_action := 'credit_added';
    v_msg    := '+' || NEW.amount || ' credits (' || NEW.type::TEXT || ')';
  ELSE
    v_action := 'credit_spent';
    v_msg    := NEW.amount || ' credits (' || NEW.type::TEXT || ')';
  END IF;

  PERFORM public._log_app_activity(
    v_action, 'billing', 'credit_transaction', NEW.id,
    NEW.type::TEXT, NEW.user_id,
    COALESCE(NEW.description, v_msg),
    jsonb_build_object(
      'amount',        NEW.amount,
      'balance_after', NEW.balance_after,
      'type',          NEW.type::TEXT
    ),
    CASE WHEN abs(NEW.amount) >= 100 THEN 25 ELSE 0 END
  );

  -- Low-balance notification: triggered the first time the balance crosses the 10-credit threshold downward
  IF NEW.amount < 0 AND NEW.balance_after BETWEEN 0 AND 10 THEN
    v_prev_balance := NEW.balance_after - NEW.amount; -- amount is negative, so this adds back the spent amount
    IF v_prev_balance > 10 THEN
      PERFORM public.create_notification(
        NEW.user_id,
        'Low credit balance',
        'You have ' || NEW.balance_after
          || ' credits remaining. Top up in Billing to keep using AI features.',
        'warning',
        '/billing'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_credit_tx_audit ON public.credit_transactions;
CREATE TRIGGER on_credit_tx_audit
  AFTER INSERT ON public.credit_transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_credit_tx_audit();

-- ============================================================
-- Broaden RLS so users can read their own activity across modules.
-- Replaces the narrow session-only policy from migration 18.
-- ============================================================
DROP POLICY IF EXISTS "Owners read own session activity" ON public.activity_logs;
DROP POLICY IF EXISTS "Owners read own activity" ON public.activity_logs;

CREATE POLICY "Owners read own activity" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = plan_owner_id);

-- ============================================================
-- RPC for the host dashboard "Recent activity" card.
-- Returns everything where the caller is plan_owner_id, newest first.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_recent_activity(p_limit INT DEFAULT 20)
RETURNS TABLE (
  id            UUID,
  actor_name    TEXT,
  action_type   TEXT,
  module        TEXT,
  entity_type   TEXT,
  entity_id     UUID,
  entity_label  TEXT,
  message       TEXT,
  details       JSONB,
  risk_score    INTEGER,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  RETURN QUERY
  SELECT al.id, al.actor_name, al.action_type, al.module, al.entity_type, al.entity_id,
         al.entity_label, al.message, al.details, al.risk_score, al.created_at
  FROM public.activity_logs al
  WHERE al.plan_owner_id = auth.uid()
  ORDER BY al.created_at DESC
  LIMIT GREATEST(1, LEAST(100, COALESCE(p_limit, 20)));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_recent_activity(INT) TO authenticated;
