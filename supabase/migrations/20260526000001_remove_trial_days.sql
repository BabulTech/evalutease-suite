-- Drop trigger and function that reference trial_days before removing the column
DROP TRIGGER IF EXISTS set_trial_expiry ON public.user_subscriptions;
DROP TRIGGER IF EXISTS trg_set_trial_expiry ON public.user_subscriptions;
DROP FUNCTION IF EXISTS public._set_trial_expiry() CASCADE;

-- Remove trial system: drop trial_days column
ALTER TABLE public.plans DROP COLUMN IF EXISTS trial_days;

-- Set 10 free AI calls on enterprise_free plan
UPDATE public.plans SET trial_ai_calls = 10 WHERE slug = 'enterprise_free';

-- Migrate any users on enterprise_starter to enterprise_free
UPDATE public.user_subscriptions
SET plan_id = (SELECT id FROM public.plans WHERE slug = 'enterprise_free' LIMIT 1)
WHERE plan_id = (SELECT id FROM public.plans WHERE slug = 'enterprise_starter' LIMIT 1);

-- Delete enterprise_starter plan
DELETE FROM public.plans WHERE slug = 'enterprise_starter';

-- Add is_ngo flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_ngo BOOLEAN NOT NULL DEFAULT false;

-- Add department field for enterprise roles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;
