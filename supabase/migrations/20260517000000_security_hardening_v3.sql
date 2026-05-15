-- ============================================================
-- SECURITY HARDENING v3
-- Fixes found in full hard-mode penetration test.
-- Run after 20260516000000_security_hardening_v2.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- FIX 1: deduct_credits — caller must equal p_user_id
-- VULN-01: Any authenticated user could drain any other user's
-- credits by passing an arbitrary p_user_id.
-- auth.uid() IS NULL = service_role context (trusted) → allowed.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id     UUID,
  p_amount      INTEGER,
  p_type        public.credit_tx_type,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance     INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- SECURITY: authenticated callers may only deduct their OWN credits.
  -- NULL auth.uid() = service_role / trusted SECURITY DEFINER chain → allowed.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'unauthorized: cannot deduct another user''s credits';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  SELECT balance INTO v_balance
  FROM public.user_credits WHERE user_id = p_user_id FOR UPDATE;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN FALSE;
  END IF;

  v_new_balance := v_balance - p_amount;

  UPDATE public.user_credits
    SET balance      = v_new_balance,
        total_spent  = total_spent + p_amount,
        updated_at   = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.credit_transactions
    (user_id, type, amount, balance_after, description, reference_id)
  VALUES
    (p_user_id, p_type, -p_amount, v_new_balance, p_description, p_reference_id);

  RETURN TRUE;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- FIX 2: add_credits — revoke from authenticated users
-- VULN-02: Any authenticated user could call add_credits to
-- give themselves or anyone else unlimited free credits.
-- Only trusted SECURITY DEFINER functions should call this.
-- ────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.add_credits(UUID, INTEGER, public.credit_tx_type, TEXT, UUID, UUID)
  FROM authenticated, anon;
-- approve_payment, approve_credit_request, transfer_credits_to_host, and
-- accept_company_invite all call this internally as SECURITY DEFINER — that
-- is allowed because they run in the service-role context chain.

-- ────────────────────────────────────────────────────────────
-- FIX 3: approve_payment — add admin role check
-- VULN-03: Any authenticated user could self-approve their own
-- pending payment by calling the RPC with their own payment UUID.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_payment(
  p_payment_id  UUID,
  p_admin_id    UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_payment public.manual_payments;
  v_credits INTEGER;
BEGIN
  -- SECURITY: only admins may approve payments.
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized: admin role required';
  END IF;
  -- Force p_admin_id to match the actual caller so it cannot be spoofed.
  IF auth.uid() <> p_admin_id THEN
    RAISE EXCEPTION 'unauthorized: p_admin_id must equal calling user';
  END IF;

  SELECT * INTO v_payment FROM public.manual_payments WHERE id = p_payment_id FOR UPDATE;
  IF v_payment IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_payment.status <> 'pending' THEN RAISE EXCEPTION 'Payment already processed'; END IF;

  -- SECURITY (VULN-07): recompute credits_to_add from the plan at approval
  -- time; never trust the user-submitted value.
  IF v_payment.plan_id IS NOT NULL THEN
    SELECT credits_per_month INTO v_credits
    FROM public.plans WHERE id = v_payment.plan_id;
    v_credits := COALESCE(v_credits, 0);
  ELSE
    v_credits := GREATEST(v_payment.credits_to_add, 0);
  END IF;

  IF v_credits > 0 THEN
    PERFORM public.add_credits(
      v_payment.user_id, v_credits,
      'payment_approved',
      'Payment approved: ' || v_payment.amount_pkr || ' PKR',
      p_payment_id, p_admin_id
    );
  END IF;

  IF v_payment.plan_id IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status, assigned_by)
      VALUES (v_payment.user_id, v_payment.plan_id, 'active', p_admin_id)
      ON CONFLICT (user_id) DO UPDATE
        SET plan_id     = v_payment.plan_id,
            status      = 'active',
            assigned_by = p_admin_id,
            updated_at  = now();
  END IF;

  UPDATE public.manual_payments
    SET status      = 'approved',
        credits_to_add = v_credits,  -- write the server-computed value back
        reviewed_by = p_admin_id,
        reviewed_at = now(),
        admin_notes = p_admin_notes,
        updated_at  = now()
  WHERE id = p_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_payment(UUID, UUID, TEXT) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- FIX 4: credit_transactions INSERT policy — lock it down
-- VULN-22: "WITH CHECK (true)" let any authenticated user insert
-- fabricated transaction rows, inflating fake credit history.
-- All real inserts go through deduct_credits / add_credits only.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "System inserts transactions" ON public.credit_transactions;
-- No INSERT policy for authenticated users. Only SECURITY DEFINER
-- functions (which run outside RLS) may insert transactions.

-- ────────────────────────────────────────────────────────────
-- FIX 5: Add 'ai_grading' to credit_tx_type enum
-- VULN-11: grade.tsx calls deduct_credits with p_type='ai_grading'
-- which is not in the enum — causing a type error and potentially
-- silently skipping the deduction (free AI grading).
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'ai_grading'
      AND enumtypid = 'public.credit_tx_type'::regtype
  ) THEN
    ALTER TYPE public.credit_tx_type ADD VALUE 'ai_grading';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- FIX 6: manual_payments — cap credits_to_add + limit pending
-- VULN-07: user submitted any credits_to_add value.
-- VULN-18: user could spam unlimited pending payments.
-- ────────────────────────────────────────────────────────────

-- Cap credits_to_add at 100,000 to prevent overflows
ALTER TABLE public.manual_payments
  ADD CONSTRAINT credits_to_add_cap
  CHECK (credits_to_add >= 0 AND credits_to_add <= 100000);

-- Only 3 pending payments per user at a time (admin DoS prevention)
CREATE OR REPLACE FUNCTION public._check_pending_payments_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (
    SELECT count(*) FROM public.manual_payments
    WHERE user_id = NEW.user_id AND status = 'pending'
  ) >= 3 THEN
    RAISE EXCEPTION 'max_pending_payments: you already have 3 pending payments. Wait for admin review.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pending_payments_limit ON public.manual_payments;
CREATE TRIGGER trg_pending_payments_limit
  BEFORE INSERT ON public.manual_payments
  FOR EACH ROW EXECUTE FUNCTION public._check_pending_payments_limit();

-- ────────────────────────────────────────────────────────────
-- FIX 7: credit_requests — cap amount to prevent admin drain
-- VULN-13: hosts could request 2 billion credits, social-engineering
-- admin into a catastrophic approval.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.credit_requests
  DROP CONSTRAINT IF EXISTS credit_requests_amount_check;
ALTER TABLE public.credit_requests
  ADD CONSTRAINT credit_requests_amount_check
  CHECK (amount > 0 AND amount <= 10000);

-- ────────────────────────────────────────────────────────────
-- FIX 8: approve_credit_request — fix PERFORM ignoring return
-- VULN-26: deduct_credits returned FALSE (insufficient balance)
-- but PERFORM discards boolean — host got credits admin didn't have.
-- NOTE: this was partially fixed in v2 but only for the new version.
-- Ensure this version is fully correct.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_credit_request(p_request_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req   public.credit_requests%ROWTYPE;
  v_admin UUID;
  v_ok    BOOLEAN;
BEGIN
  SELECT * INTO v_req FROM public.credit_requests WHERE id = p_request_id FOR UPDATE;
  IF v_req.id IS NULL OR v_req.status <> 'pending' THEN RETURN FALSE; END IF;

  SELECT admin_user_id INTO v_admin
  FROM public.company_profiles WHERE id = v_req.company_id LIMIT 1;

  IF v_admin IS NULL OR v_admin <> auth.uid() THEN RETURN FALSE; END IF;

  -- Cap guard: re-check amount constraint server-side
  IF v_req.amount <= 0 OR v_req.amount > 10000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT public.deduct_credits(
    v_admin, v_req.amount, 'admin_adjustment',
    COALESCE('Approved credit request: ' || v_req.note, 'Approved credit request')
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  PERFORM public.add_credits(
    v_req.requester_user_id, v_req.amount, 'admin_adjustment',
    COALESCE('Credit request approved: ' || v_req.note, 'Credit request approved'),
    v_req.member_id, v_admin
  );

  UPDATE public.credit_requests
    SET status      = 'approved',
        resolved_by = v_admin,
        resolved_at = now(),
        updated_at  = now()
  WHERE id = p_request_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_credit_request(UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- FIX 9: Access code generation — server-side via Postgres
-- VULN-21: Math.random() is not cryptographically secure.
-- A new RPC wraps gen_random_bytes for cryptographic codes.
-- The session-creation client will call this instead of the JS fn.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_session_access_code()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  -- gen_random_uuid() is always available in Supabase (no extension needed).
  -- We take 6 hex chars from the UUID for a cryptographically random code.
  SELECT upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;

GRANT EXECUTE ON FUNCTION public.generate_session_access_code() TO authenticated;

-- ────────────────────────────────────────────────────────────
-- FIX 10: quiz_sessions RLS — ensure owner isolation on SELECT
-- VULN-10 / VULN-19: If quiz_attempts/answers don't enforce
-- session ownership, any authenticated user can read all attempts.
-- ────────────────────────────────────────────────────────────

-- quiz_attempts: reads restricted to session owner
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'quiz_attempts' AND policyname = 'Owner reads session attempts'
  ) THEN
    -- Drop any open policy first
    DROP POLICY IF EXISTS "Owners read attempts" ON public.quiz_attempts;
    CREATE POLICY "Owner reads session attempts" ON public.quiz_attempts
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.quiz_sessions qs
          WHERE qs.id = session_id AND qs.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- quiz_answers: reads restricted to session owner (via attempt join)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'quiz_answers' AND policyname = 'Owner reads session answers'
  ) THEN
    DROP POLICY IF EXISTS "Owners read answers" ON public.quiz_answers;
    CREATE POLICY "Owner reads session answers" ON public.quiz_answers
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.quiz_attempts qa
          JOIN public.quiz_sessions qs ON qs.id = qa.session_id
          WHERE qa.id = attempt_id AND qs.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- quiz_answers UPDATE: only session owner may update (for grading)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'quiz_answers' AND policyname = 'Owner updates own session answers'
  ) THEN
    CREATE POLICY "Owner updates own session answers" ON public.quiz_answers
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.quiz_attempts qa
          JOIN public.quiz_sessions qs ON qs.id = qa.session_id
          WHERE qa.id = attempt_id AND qs.owner_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- FIX 11: Admin credit adjustment RPCs
-- VULN-20: admin panel called add_credits / deduct_credits directly
-- on other users — now blocked by the auth.uid() check in FIX 1.
-- Provide admin-gated wrappers with a hard cap (50,000 per adjustment).
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_adjust_credits(
  p_user_id     UUID,
  p_amount      INTEGER,
  p_direction   TEXT,   -- 'add' or 'deduct'
  p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized: admin role required';
  END IF;
  IF p_amount <= 0 OR p_amount > 50000 THEN
    RAISE EXCEPTION 'amount must be between 1 and 50,000';
  END IF;
  IF p_direction NOT IN ('add', 'deduct') THEN
    RAISE EXCEPTION 'direction must be add or deduct';
  END IF;

  IF p_direction = 'add' THEN
    PERFORM public.add_credits(
      p_user_id, p_amount, 'admin_adjustment',
      COALESCE(p_description, 'Admin credit adjustment'),
      NULL, auth.uid()
    );
    RETURN TRUE;
  ELSE
    RETURN public.deduct_credits(
      p_user_id, p_amount, 'admin_adjustment',
      COALESCE(p_description, 'Admin credit deduction')
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(UUID, INTEGER, TEXT, TEXT) TO authenticated;
