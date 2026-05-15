-- Add session launch and export credit cost columns to plans
-- Both default 0 (free) — admin can set non-zero to charge credits

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS credit_cost_session_launch INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_cost_export          INTEGER NOT NULL DEFAULT 0;

-- Reset AI costs to accurate values based on actual Anthropic API costs:
-- 1 credit ≈ 2 PKR ≈ $0.007
-- AI 10 questions ≈ $0.006 → 10 credits per 10q (1 per question, clean math)
-- AI image scan   ≈ $0.008 → 1 credit per scan
UPDATE public.plans SET
  credit_cost_ai_10q  = 10,
  credit_cost_ai_scan = 1;
