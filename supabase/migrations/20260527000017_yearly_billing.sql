-- ============================================================
-- Yearly billing support
--   * app_settings: singleton row holding global knobs (yearly discount %)
--   * manual_payments.billing_cycle: monthly | yearly
-- ============================================================

-- ── App settings (singleton) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_settings (
  id                        BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  yearly_discount_percent   INTEGER NOT NULL DEFAULT 10
                              CHECK (yearly_discount_percent >= 0 AND yearly_discount_percent <= 100),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (id, yearly_discount_percent)
VALUES (true, 10)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads app settings" ON public.app_settings;
CREATE POLICY "Anyone reads app settings" ON public.app_settings
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Admins write app settings" ON public.app_settings;
CREATE POLICY "Admins write app settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER app_settings_touch BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── manual_payments.billing_cycle ───────────────────────────
ALTER TABLE public.manual_payments
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly','yearly'));
