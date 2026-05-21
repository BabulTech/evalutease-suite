ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS grading_mode TEXT NOT NULL DEFAULT 'auto'
    CHECK (grading_mode IN ('auto', 'ai', 'manual'));

-- Back-fill: questions that had requires_manual_grading = true → 'manual'
UPDATE public.questions
  SET grading_mode = 'manual'
  WHERE requires_manual_grading = TRUE AND type IN ('short_answer', 'long_answer');

-- Long answers default to 'manual' if not set
UPDATE public.questions
  SET grading_mode = 'manual'
  WHERE type = 'long_answer' AND grading_mode = 'auto';
