-- ============================================================
-- credit_requests — hosts request more credits from their admin.
-- Separate from credit_transactions because requests are intents,
-- not actual balance changes. Once approved by the admin, the
-- transfer creates a real row in credit_transactions.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.credit_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id         UUID NOT NULL REFERENCES public.company_members(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  amount            INTEGER NOT NULL CHECK (amount > 0),
  note              TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  resolved_by       UUID REFERENCES auth.users(id),
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_requests_company ON public.credit_requests(company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_requests_requester ON public.credit_requests(requester_user_id, created_at DESC);

ALTER TABLE public.credit_requests ENABLE ROW LEVEL SECURITY;

-- Drop in case rerun
DROP POLICY IF EXISTS "host_insert_own_request" ON public.credit_requests;
DROP POLICY IF EXISTS "host_read_own_requests" ON public.credit_requests;
DROP POLICY IF EXISTS "admin_read_company_requests" ON public.credit_requests;
DROP POLICY IF EXISTS "admin_update_company_requests" ON public.credit_requests;

-- Host inserts their own request — but only for their own active membership
CREATE POLICY "host_insert_own_request" ON public.credit_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_user_id = auth.uid()
    AND member_id IN (
      SELECT id FROM public.company_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Host reads their own requests
CREATE POLICY "host_read_own_requests" ON public.credit_requests
  FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid());

-- Admin reads requests for their company
CREATE POLICY "admin_read_company_requests" ON public.credit_requests
  FOR SELECT TO authenticated
  USING (company_id = public.get_my_company_id());

-- Admin updates (approve/decline) requests for their company
CREATE POLICY "admin_update_company_requests" ON public.credit_requests
  FOR UPDATE TO authenticated
  USING (company_id = public.get_my_company_id())
  WITH CHECK (company_id = public.get_my_company_id());

-- Atomic approve function: transfers credits and marks request approved.
CREATE OR REPLACE FUNCTION public.approve_credit_request(p_request_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req    public.credit_requests%ROWTYPE;
  v_admin  UUID;
BEGIN
  SELECT * INTO v_req FROM public.credit_requests WHERE id = p_request_id LIMIT 1;
  IF v_req.id IS NULL OR v_req.status <> 'pending' THEN RETURN FALSE; END IF;

  SELECT admin_user_id INTO v_admin
    FROM public.company_profiles WHERE id = v_req.company_id LIMIT 1;
  IF v_admin IS NULL OR v_admin <> auth.uid() THEN RETURN FALSE; END IF;

  -- Transfer credits admin → host
  PERFORM public.deduct_credits(
    v_admin, v_req.amount, 'admin_adjustment',
    COALESCE('Approved credit request: ' || v_req.note, 'Approved credit request')
  );
  PERFORM public.add_credits(
    v_req.requester_user_id, v_req.amount, 'admin_adjustment',
    COALESCE('Credit request approved: ' || v_req.note, 'Credit request approved'),
    v_req.member_id, v_admin
  );

  UPDATE public.credit_requests
     SET status = 'approved',
         resolved_by = v_admin,
         resolved_at = now(),
         updated_at = now()
   WHERE id = p_request_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_credit_request(p_request_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req public.credit_requests%ROWTYPE; v_admin UUID;
BEGIN
  SELECT * INTO v_req FROM public.credit_requests WHERE id = p_request_id LIMIT 1;
  IF v_req.id IS NULL OR v_req.status <> 'pending' THEN RETURN FALSE; END IF;
  SELECT admin_user_id INTO v_admin FROM public.company_profiles WHERE id = v_req.company_id LIMIT 1;
  IF v_admin IS NULL OR v_admin <> auth.uid() THEN RETURN FALSE; END IF;

  UPDATE public.credit_requests
     SET status = 'declined',
         resolved_by = v_admin,
         resolved_at = now(),
         updated_at = now()
   WHERE id = p_request_id;
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_credit_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_credit_request(UUID) TO authenticated;
