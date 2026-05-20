-- Add per-question-type AI credit cost columns to plans.
-- The existing credit_cost_ai_10q becomes the MCQ/default rate.
-- New columns allow admin to charge more for expensive question types.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS credit_cost_ai_tf_10q     NUMERIC NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS credit_cost_ai_short_10q  NUMERIC NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS credit_cost_ai_long_10q   NUMERIC NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS credit_cost_ai_mix_10q    NUMERIC NOT NULL DEFAULT 6;

-- Populate existing plans so they don't start at zero
UPDATE public.plans
SET
  credit_cost_ai_tf_10q    = credit_cost_ai_10q,
  credit_cost_ai_short_10q = GREATEST(credit_cost_ai_10q * 1.5, 5),
  credit_cost_ai_long_10q  = GREATEST(credit_cost_ai_10q * 3,   10),
  credit_cost_ai_mix_10q   = GREATEST(credit_cost_ai_10q * 2,   6);
