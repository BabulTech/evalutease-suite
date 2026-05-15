-- Add 'long_answer' to the question_type enum.
-- Kept as a separate migration because ALTER TYPE ADD VALUE has historically
-- needed its own transaction; this isolates the risk.
ALTER TYPE public.question_type ADD VALUE IF NOT EXISTS 'long_answer';
