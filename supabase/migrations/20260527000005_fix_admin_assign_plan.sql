-- Fix admin_assign_plan: cast TEXT to plan_slug enum for the WHERE clause
-- Also removes dead enterprise_starter trial logic

CREATE OR REPLACE FUNCTION public.admin_assign_plan(
  p_user_id UUID,
  p_plan_slug TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT id INTO v_plan_id
  FROM public.plans
  WHERE slug = p_plan_slug::public.plan_slug
    AND is_active = true
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plan not found: %', p_plan_slug;
  END IF;

  INSERT INTO public.user_subscriptions (user_id, plan_id, status, expires_at)
  VALUES (p_user_id, v_plan_id, 'active', NULL)
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id    = EXCLUDED.plan_id,
    status     = 'active',
    expires_at = NULL,
    updated_at = now();

  UPDATE public.profiles
  SET selected_plan = p_plan_slug,
      updated_at    = now()
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_plan(UUID, TEXT) TO authenticated;

-- Also fix the migration SQL that uses slug = 'text' comparison
UPDATE public.plans
SET question_bank = -1, participants_total = -1, participants_per_session = -1,
    quizzes_per_day = -1, sessions_total = -1
WHERE slug = 'enterprise_pro'::public.plan_slug;

UPDATE public.plans
SET question_bank = -1, participants_total = -1, sessions_total = -1
WHERE slug = 'individual_pro'::public.plan_slug;
