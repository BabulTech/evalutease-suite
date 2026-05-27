-- Enterprise Pro and Enterprise Elite should have unlimited question bank and participants
-- Enterprise Pro: fully unlimited
UPDATE public.plans
SET
  question_bank            = -1,
  participants_total       = -1,
  participants_per_session = -1,
  quizzes_per_day          = -1,
  sessions_total           = -1
WHERE slug = 'enterprise_pro';

-- Individual Pro: unlimited questions, participants, sessions
UPDATE public.plans
SET
  question_bank      = -1,
  participants_total = -1,
  sessions_total     = -1
WHERE slug = 'individual_pro';
