-- Ensure admins can SELECT all manual_payments rows.
-- The previous "FOR ALL" policy is split into explicit per-command policies
-- to avoid any ambiguity with RLS USING vs WITH CHECK on SELECT.

DROP POLICY IF EXISTS "Admins manage all payments" ON public.manual_payments;

CREATE POLICY "Admins select all payments" ON public.manual_payments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert payments" ON public.manual_payments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update payments" ON public.manual_payments
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete payments" ON public.manual_payments
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
