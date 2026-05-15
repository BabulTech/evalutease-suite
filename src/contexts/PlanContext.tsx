import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useHost } from "@/contexts/HostContext";

// ─── Plan types ───────────────────────────────────────────────
export type PlanSlug =
  | "individual_starter"
  | "individual_pro"
  | "individual_pro_plus"
  | "enterprise_starter"
  | "enterprise_pro"
  | "enterprise_elite";

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
  // Credit costs
  credit_cost_ai_10q: number;
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

type PlanContextValue = {
  plan: PlanInfo | null;
  credits: CreditInfo;
  usage: PlanUsage;
  loading: boolean;
  isAiAllowed: boolean;
  isExpired: boolean;
  daysUntilExpiry: number | null; // null = no expiry set
  /** true when a hard limit is exhausted */
  isLocked: (key: keyof PlanLimits) => boolean;
  /** -1 = unlimited */
  remaining: (key: keyof PlanLimits) => number;
  /** 0-100 percent used */
  usedPct: (key: keyof PlanLimits) => number;
  reload: () => void;
  allPlans: PlanInfo[];
};

export type PlanLimits = {
  quizzes_per_day: number;
  participants_per_session: number;
  participants_total: number;
  question_bank: number;
  sessions_total: number;
};

// Default free plan fallback
const FREE_PLAN: PlanInfo = {
  id: "",
  slug: "individual_starter",
  tier: "individual",
  name: "Starter",
  description: "Free plan",
  price_pkr: 0,
  credits_per_month: 0,
  quizzes_per_day: 3,
  participants_per_session: 50,
  participants_total: 50,
  question_bank: 50,
  sessions_total: -1,
  max_hosts: 0,
  ai_calls_per_day: 0,
  ai_enabled: false,
  custom_branding: false,
  white_label: false,
  ai_interview: false,
  ai_coding_test: false,
  credit_cost_ai_10q: 3,
  credit_cost_ai_scan: 2,
  credit_cost_ai_interview: 5,
  credit_cost_ai_coding: 5,
  credit_cost_ai_grade_short: 1,
  credit_cost_ai_grade_long: 3,
  credit_cost_extra_quiz: 1,
  credit_cost_extra_participants: 1,
  credit_cost_session_launch: 0,
  credit_cost_export: 0,
  features_list: [],
};

const PlanContext = createContext<PlanContextValue>({
  plan: null,
  credits: { balance: 0, total_earned: 0, total_spent: 0 },
  usage: { quizzes_today: 0, questions_total: 0, participants_total: 0, sessions_total: 0 },
  loading: true,
  isAiAllowed: false,
  isExpired: false,
  daysUntilExpiry: null,
  isLocked: () => false,
  remaining: () => 0,
  usedPct: () => 0,
  reload: () => {},
  allPlans: [],
});

function rowToPlan(raw: Record<string, unknown>): PlanInfo {
  return {
    id: raw.id as string,
    slug: raw.slug as PlanSlug,
    tier: raw.tier as PlanTier,
    name: raw.name as string,
    description: (raw.description as string) ?? "",
    price_pkr: (raw.price_pkr as number) ?? 0,
    credits_per_month: (raw.credits_per_month as number) ?? 0,
    quizzes_per_day: (raw.quizzes_per_day as number) ?? 3,
    participants_per_session: (raw.participants_per_session as number) ?? 50,
    participants_total: (raw.participants_total as number) ?? 50,
    question_bank: (raw.question_bank as number) ?? 50,
    sessions_total: (raw.sessions_total as number) ?? -1,
    max_hosts: (raw.max_hosts as number) ?? 0,
    ai_calls_per_day: (raw.ai_calls_per_day as number) ?? 0,
    ai_enabled: (raw.ai_enabled as boolean) ?? false,
    custom_branding: (raw.custom_branding as boolean) ?? false,
    white_label: (raw.white_label as boolean) ?? false,
    ai_interview: (raw.ai_interview as boolean) ?? false,
    ai_coding_test: (raw.ai_coding_test as boolean) ?? false,
    credit_cost_ai_10q: (raw.credit_cost_ai_10q as number) ?? 3,
    credit_cost_ai_scan: (raw.credit_cost_ai_scan as number) ?? 2,
    credit_cost_ai_interview: (raw.credit_cost_ai_interview as number) ?? 5,
    credit_cost_ai_coding: (raw.credit_cost_ai_coding as number) ?? 5,
    credit_cost_ai_grade_short: (raw.credit_cost_ai_grade_short as number) ?? 1,
    credit_cost_ai_grade_long: (raw.credit_cost_ai_grade_long as number) ?? 3,
    credit_cost_extra_quiz: (raw.credit_cost_extra_quiz as number) ?? 1,
    credit_cost_extra_participants: (raw.credit_cost_extra_participants as number) ?? 1,
    credit_cost_session_launch: (raw.credit_cost_session_launch as number) ?? 0,
    credit_cost_export: (raw.credit_cost_export as number) ?? 0,
    features_list: (raw.features_list as string[]) ?? [],
  };
}

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { hostInfo, loading: hostLoading } = useHost();
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [allPlans, setAllPlans] = useState<PlanInfo[]>([]);
  const [credits, setCredits] = useState<CreditInfo>({ balance: 0, total_earned: 0, total_spent: 0 });
  const [usage, setUsage] = useState<PlanUsage>({
    quizzes_today: 0, questions_total: 0, participants_total: 0, sessions_total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || hostLoading) return;
    setLoading(true);

    const today = new Date().toISOString().slice(0, 10) + "T00:00:00Z";

    // For hosts, the "active plan" comes from the org admin's subscription, not their own.
    const planOwnerId = hostInfo?.admin_user_id ?? user.id;

    const [subRes, creditsRes, allPlansRes, quizzesToday, questionsTotal, participantsTotal, sessionsTotal] =
      await Promise.all([
        supabase
          .from("user_subscriptions")
          .select("*, plans(*)")
          .eq("user_id", planOwnerId)
          .eq("status", "active")
          .maybeSingle(),
        supabase
          .from("user_credits")
          .select("balance, total_earned, total_spent")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("plans")
          .select("*")
          .eq("is_active", true)
          .order("sort_order"),
        supabase
          .from("quiz_sessions")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id)
          .gte("created_at", today),
        supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id),
        supabase
          .from("participants")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id),
        supabase
          .from("quiz_sessions")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id),
      ]);

    // Set all plans
    if (allPlansRes.data) {
      setAllPlans((allPlansRes.data as Record<string, unknown>[]).map(rowToPlan));
    }

    // Set credits
    if (creditsRes.data) {
      setCredits({
        balance: creditsRes.data.balance ?? 0,
        total_earned: creditsRes.data.total_earned ?? 0,
        total_spent: creditsRes.data.total_spent ?? 0,
      });
    }

    // Set current plan — downgrade to free if subscription expired (not relevant for hosts; org admin manages renewal)
    const sub = subRes.data;
    const planRaw = sub?.plans as Record<string, unknown> | null;
    const expiry = (sub?.expires_at as string | null) ?? null;
    setExpiresAt(hostInfo ? null : expiry); // hide expiry surface for hosts
    const isExpiredSub = hostInfo ? false : (expiry ? new Date(expiry) < new Date() : false);
    setPlan(planRaw && !isExpiredSub ? rowToPlan(planRaw) : { ...FREE_PLAN });

    // Set usage
    setUsage({
      quizzes_today: quizzesToday.count ?? 0,
      questions_total: questionsTotal.count ?? 0,
      participants_total: participantsTotal.count ?? 0,
      sessions_total: sessionsTotal.count ?? 0,
    });

    setLoading(false);
  }, [user, hostInfo, hostLoading]);

  useEffect(() => { void load(); }, [load]);

  const currentPlan = plan ?? FREE_PLAN;

  const limitFor = (key: keyof PlanLimits): number => {
    const map: Record<keyof PlanLimits, number> = {
      quizzes_per_day: currentPlan.quizzes_per_day,
      participants_per_session: currentPlan.participants_per_session,
      participants_total: currentPlan.participants_total,
      question_bank: currentPlan.question_bank,
      sessions_total: currentPlan.sessions_total,
    };
    return map[key];
  };

  const usedFor = (key: keyof PlanLimits): number => {
    if (key === "quizzes_per_day") return usage.quizzes_today;
    if (key === "question_bank") return usage.questions_total;
    if (key === "participants_total") return usage.participants_total;
    if (key === "sessions_total") return usage.sessions_total;
    return 0;
  };

  const remaining = (key: keyof PlanLimits): number => {
    const limit = limitFor(key);
    if (limit === -1) return Infinity;
    return Math.max(0, limit - usedFor(key));
  };

  const isLocked = (key: keyof PlanLimits): boolean => {
    const limit = limitFor(key);
    if (limit === -1) return false;
    return usedFor(key) >= limit;
  };

  const usedPct = (key: keyof PlanLimits): number => {
    const limit = limitFor(key);
    if (limit === -1) return 0;
    return Math.min(100, Math.round((usedFor(key) / limit) * 100));
  };

  // Hosts always have AI access (they pay via org credits).
  // Any paid plan (non-free, non-individual_starter) also gets AI.
  // The credit balance gates actual usage at the server level.
  const isPaidPlan = currentPlan.slug !== "free" && currentPlan.slug !== "individual_starter";
  const isAiAllowed = !!hostInfo || currentPlan.ai_enabled || isPaidPlan;
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
  const daysUntilExpiry = expiresAt
    ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <PlanContext.Provider value={{
      plan: currentPlan,
      credits,
      usage,
      loading,
      isAiAllowed,
      isExpired,
      daysUntilExpiry,
      isLocked,
      remaining,
      usedPct,
      reload: load,
      allPlans,
    }}>
      {children}
    </PlanContext.Provider>
  );
}

export const usePlan = () => useContext(PlanContext);
