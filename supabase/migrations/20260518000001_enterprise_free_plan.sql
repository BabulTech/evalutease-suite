-- ============================================================
-- Add Enterprise Free plan (post-trial fallback)
-- Same limits as Individual Free but with 3 hosts allowed.
-- expire_trials() now downgrades to enterprise_free instead
-- of individual_starter so team members retain access.
-- ============================================================

-- ── 1) Insert enterprise_free plan ──────────────────────────
INSERT INTO public.plans (
  slug, tier, name, description, price_pkr, credits_per_month, sort_order, is_active,
  quizzes_per_day, scheduled_quizzes_per_day, participants_per_session,
  participants_total, question_bank, sessions_total, max_hosts,
  ai_calls_per_day, ai_enabled, custom_branding, white_label,
  ai_interview, ai_coding_test,
  watermark_enabled, file_export_watermark, email_template_allowed,
  trial_days, trial_ai_calls, can_buy_credits,
  credit_cost_ai_10q, credit_cost_ai_scan, credit_cost_ai_interview,
  credit_cost_ai_coding, credit_cost_ai_grade_short, credit_cost_ai_grade_long,
  credit_cost_extra_quiz, credit_cost_extra_participants,
  credit_cost_session_launch, credit_cost_export,
  features_list
) VALUES (
  'enterprise_free','enterprise','Enterprise Free',
  'Free forever for organisations. Same limits as Individual Free but supports up to 3 hosts.',
  0, 0, 25, true,
  3, 1, 50,
  50, 100, -1, 3,
  0, false, false, false,
  false, false,
  true, true, false,
  0, 0, false,
  3, 2, 5, 5, 1, 3,
  1, 1, 0, 0,
  ARRAY[
    '3 Quiz Sessions per day',
    '1 Scheduled Quiz per day',
    '100 Question Bank',
    '50 Active Participants',
    'Up to 3 Hosts',
    'File export with watermark',
    'Basic Analytics',
    'No AI features'
  ]
)
ON CONFLICT (slug) DO UPDATE SET
  name                      = EXCLUDED.name,
  description               = EXCLUDED.description,
  price_pkr                 = EXCLUDED.price_pkr,
  credits_per_month         = EXCLUDED.credits_per_month,
  sort_order                = EXCLUDED.sort_order,
  quizzes_per_day           = EXCLUDED.quizzes_per_day,
  scheduled_quizzes_per_day = EXCLUDED.scheduled_quizzes_per_day,
  participants_per_session  = EXCLUDED.participants_per_session,
  participants_total        = EXCLUDED.participants_total,
  question_bank             = EXCLUDED.question_bank,
  sessions_total            = EXCLUDED.sessions_total,
  max_hosts                 = EXCLUDED.max_hosts,
  ai_calls_per_day          = EXCLUDED.ai_calls_per_day,
  ai_enabled                = EXCLUDED.ai_enabled,
  custom_branding           = EXCLUDED.custom_branding,
  white_label               = EXCLUDED.white_label,
  watermark_enabled         = EXCLUDED.watermark_enabled,
  file_export_watermark     = EXCLUDED.file_export_watermark,
  email_template_allowed    = EXCLUDED.email_template_allowed,
  trial_days                = EXCLUDED.trial_days,
  trial_ai_calls            = EXCLUDED.trial_ai_calls,
  can_buy_credits           = EXCLUDED.can_buy_credits,
  credit_cost_ai_10q        = EXCLUDED.credit_cost_ai_10q,
  credit_cost_ai_scan       = EXCLUDED.credit_cost_ai_scan,
  features_list             = EXCLUDED.features_list,
  updated_at                = now();

-- ── 2) Update expire_trials() to downgrade to enterprise_free ─
CREATE OR REPLACE FUNCTION public.expire_trials()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_starter_id      UUID;
  v_enterprise_free_id UUID;
  v_count           INTEGER := 0;
BEGIN
  SELECT id INTO v_starter_id       FROM public.plans WHERE slug = 'enterprise_starter'  LIMIT 1;
  SELECT id INTO v_enterprise_free_id FROM public.plans WHERE slug = 'enterprise_free' LIMIT 1;

  IF v_starter_id IS NULL OR v_enterprise_free_id IS NULL THEN RETURN 0; END IF;

  -- Downgrade expired trial users to enterprise_free (keeps 3 hosts)
  UPDATE public.user_subscriptions us
  SET plan_id    = v_enterprise_free_id,
      status     = 'active',
      expires_at = NULL,
      updated_at = now()
  FROM public.trial_ai_usage tau
  WHERE us.plan_id  = v_starter_id
    AND us.status   = 'active'
    AND tau.user_id = us.user_id
    AND tau.trial_end < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_trials() FROM authenticated, anon;
