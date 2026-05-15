-- ============================================================
-- Phase 1: type-specific columns for the 4 question kinds.
-- All nullable / defaulted so existing MCQ rows keep working.
-- ============================================================

-- Type-specific fields on questions
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS acceptable_answers     TEXT[],
  ADD COLUMN IF NOT EXISTS model_answer           TEXT,
  ADD COLUMN IF NOT EXISTS rubric                 TEXT,
  ADD COLUMN IF NOT EXISTS max_points             INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS requires_manual_grading BOOLEAN NOT NULL DEFAULT FALSE;

-- Grading metadata on quiz_answers — points_awarded becomes the source of truth.
-- is_correct stays for backward compat (we'll keep writing it for auto-graded types).
ALTER TABLE public.quiz_answers
  ADD COLUMN IF NOT EXISTS points_awarded  INT,
  ADD COLUMN IF NOT EXISTS graded_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS graded_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grader_comment  TEXT,
  ADD COLUMN IF NOT EXISTS graded_by_ai    BOOLEAN NOT NULL DEFAULT FALSE;

-- AI grading credit costs on plans
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS credit_cost_ai_grade_short INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS credit_cost_ai_grade_long  INT NOT NULL DEFAULT 3;

-- Backfill existing answer rows: points_awarded = (is_correct ? 1 : 0) for MCQs/T-F
UPDATE public.quiz_answers
   SET points_awarded = CASE WHEN is_correct THEN 1 ELSE 0 END
 WHERE points_awarded IS NULL AND is_correct IS NOT NULL;
