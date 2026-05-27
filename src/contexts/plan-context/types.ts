export type PlanSlug =
  | "individual_starter"
  | "individual_pro"
  | "enterprise_free"
  | "enterprise_pro";

export type PlanTier = "individual" | "enterprise";

export type PlanInfo = {
  id: string;
  slug: PlanSlug;
  tier: PlanTier;
  name: string;
  description: string;
  price_pkr: number;
  credits_per_month: number;
  // Hard limits (-1 = unlimited)
  quizzes_per_day: number;
  scheduled_quizzes_per_day: number;
  participants_per_session: number;
  participants_total: number;
  question_bank: number;
  sessions_total: number;
  max_hosts: number;
  ai_calls_per_day: number;
  // Feature flags
  ai_enabled: boolean;
  custom_branding: boolean;
  white_label: boolean;
  ai_interview: boolean;
  ai_coding_test: boolean;
  watermark_enabled: boolean;
  file_export_watermark: boolean;
  email_template_allowed: boolean;
  can_buy_credits: boolean;
  // Trial
  trial_days: number;
  trial_ai_calls: number;
  // Credit costs
  credit_cost_ai_10q: number;
  credit_cost_ai_tf_10q: number;
  credit_cost_ai_short_10q: number;
  credit_cost_ai_long_10q: number;
  credit_cost_ai_mix_10q: number;
  credit_cost_ai_scan: number;
  credit_cost_ai_interview: number;
  credit_cost_ai_coding: number;
  credit_cost_ai_grade_short: number;
  credit_cost_ai_grade_long: number;
  credit_cost_extra_quiz: number;
  credit_cost_extra_participants: number;
  credit_cost_session_launch: number;
  credit_cost_export: number;
  features_list: string[];
};

export type CreditInfo = {
  balance: number;
  total_earned: number;
  total_spent: number;
};

export type PlanUsage = {
  quizzes_today: number;
  questions_total: number;
  participants_total: number;
  sessions_total: number;
};

export type PlanLimits = {
  quizzes_per_day: number;
  participants_per_session: number;
  participants_total: number;
  question_bank: number;
  sessions_total: number;
};

export type PlanContextValue = {
  plan: PlanInfo | null;
  credits: CreditInfo;
  usage: PlanUsage;
  loading: boolean;
  isAiAllowed: boolean;
  isExpired: boolean;
  daysUntilExpiry: number | null;
  isLocked: (key: keyof PlanLimits) => boolean;
  remaining: (key: keyof PlanLimits) => number;
  usedPct: (key: keyof PlanLimits) => number;
  reload: () => void;
  allPlans: PlanInfo[];
};
