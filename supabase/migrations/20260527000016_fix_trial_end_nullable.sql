-- enterprise_free is a lifetime allocation, not a time-based trial.
-- trial_end must be nullable; the existing NOT NULL constraint caused
-- every INSERT in consumeFreeAiCall() to silently fail, letting users
-- generate AI questions without the counter ever incrementing.

ALTER TABLE public.trial_ai_usage ALTER COLUMN trial_end DROP NOT NULL;
