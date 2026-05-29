-- ============================================================
-- Gate internal plan economics from anonymous visitors
-- (pentest observation: /rest/v1/plans exposed credit_cost_* etc.)
--
-- The public signup/pricing page only needs marketing fields
-- (name, price, credits, feature list, limits). Internal credit
-- economics (credit_cost_*) should not be world-readable.
--
-- Approach: stop exposing the table to anon entirely, and serve a
-- curated subset through a SECURITY DEFINER RPC. Authenticated
-- users keep full table read access; the service role (server fns)
-- is unaffected (bypasses RLS).
-- ============================================================

-- ── 1. Restrict direct table reads to authenticated users ────
DROP POLICY IF EXISTS "Plans are publicly readable" ON public.plans;
CREATE POLICY "Plans readable by authenticated" ON public.plans
  FOR SELECT TO authenticated USING (true);

-- Belt-and-suspenders: ensure anon can't read the table directly.
REVOKE SELECT ON public.plans FROM anon;

-- ── 2. Curated public view of plans for the signup page ──────
-- Returns every active plan minus the internal credit-cost keys.
-- The "- 'key'" jsonb operator is a no-op when the key is absent,
-- so this stays correct as columns are added/removed over time.
CREATE OR REPLACE FUNCTION public.get_public_plans()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      (to_jsonb(p)
        - 'credit_cost_ai_10q'        - 'credit_cost_ai_tf_10q'
        - 'credit_cost_ai_short_10q'  - 'credit_cost_ai_long_10q'
        - 'credit_cost_ai_mix_10q'    - 'credit_cost_ai_scan'
        - 'credit_cost_ai_interview'  - 'credit_cost_ai_coding'
        - 'credit_cost_ai_grade_short'- 'credit_cost_ai_grade_long'
        - 'credit_cost_extra_quiz'    - 'credit_cost_extra_participants'
        - 'credit_cost_session_launch'- 'credit_cost_export'
      ) ORDER BY p.sort_order
    ),
    '[]'::jsonb
  )
  FROM public.plans p
  WHERE p.is_active = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_plans() TO anon, authenticated;

COMMENT ON FUNCTION public.get_public_plans() IS
  'Marketing-safe plan list for the public signup page. Excludes internal credit_cost_* economics. Authenticated users read the plans table directly.';
