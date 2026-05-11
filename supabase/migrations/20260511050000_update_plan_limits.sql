-- Update plans with correct limits and features per product spec

UPDATE public.plans SET
  price_monthly = 0,
  price_yearly  = 0,
  description   = 'Perfect for getting started with quizzes',
  limits = '{
    "quizzes_per_day":          3,
    "ai_calls_per_day":         2,
    "participants_per_session":  20,
    "participants_total":        50,
    "question_bank":             100,
    "schedules_per_day":         1,
    "custom_branding":           0,
    "custom_marking":            0,
    "custom_time_bonus":         0
  }'::jsonb,
  features = '[
    "3 quizzes per day",
    "2 AI calls per day",
    "Up to 20 participants per quiz (50 total active)",
    "100 active questions",
    "1 custom schedule per day",
    "Reports & dashboards",
    "Sign in with Gmail or Facebook",
    "Fixed marks per question",
    "Fixed time bonus (= question mark)"
  ]'::jsonb
WHERE slug = 'free';

UPDATE public.plans SET
  price_monthly = 4.99,
  price_yearly  = 47.99,
  description   = 'More power for teachers and small teams',
  limits = '{
    "quizzes_per_day":          10,
    "ai_calls_per_day":         10,
    "participants_per_session":  50,
    "participants_total":        200,
    "question_bank":             200,
    "schedules_per_day":         10,
    "custom_branding":           1,
    "custom_marking":            1,
    "custom_time_bonus":         1
  }'::jsonb,
  features = '[
    "10 quizzes per day",
    "10 AI calls per day",
    "Up to 50 participants per quiz (200 total active)",
    "200 active questions",
    "10 custom schedules per day",
    "Reports & dashboards",
    "Sign in with Gmail or Facebook",
    "Customizable marks per question",
    "Customizable time bonus",
    "Custom branding"
  ]'::jsonb
WHERE slug = 'pro';

UPDATE public.plans SET
  price_monthly = 8.99,
  price_yearly  = 86.99,
  description   = 'Full power for institutions and large organisations',
  limits = '{
    "quizzes_per_day":          100,
    "ai_calls_per_day":         100,
    "participants_per_session":  100,
    "participants_total":        1000,
    "question_bank":             -1,
    "schedules_per_day":         50,
    "custom_branding":           1,
    "custom_marking":            1,
    "custom_time_bonus":         1
  }'::jsonb,
  features = '[
    "100 quizzes per day",
    "100 AI calls per day",
    "Up to 100 participants per quiz (1 000 total active)",
    "Unlimited active questions",
    "50 custom schedules per day",
    "Reports & dashboards",
    "Sign in with Gmail or Facebook",
    "Customizable marks per question",
    "Customizable time bonus",
    "Custom branding"
  ]'::jsonb
WHERE slug = 'enterprise';
