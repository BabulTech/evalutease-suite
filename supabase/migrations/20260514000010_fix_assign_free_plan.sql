-- A legacy assign_free_plan() trigger function references plan slug 'free',
-- which no longer exists in the plan_slug enum (renamed to 'individual_starter').
-- Replace its body with a safe lookup so backfills and signups stop failing.
CREATE OR REPLACE FUNCTION public.assign_free_plan()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  SELECT id INTO v_plan_id
  FROM public.plans
  WHERE slug = 'individual_starter'
  LIMIT 1;

  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, plan_id, status)
    VALUES (NEW.id, v_plan_id, 'active')
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.user_credits (user_id, balance)
    VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- never block whatever fires this trigger
END;
$$;
