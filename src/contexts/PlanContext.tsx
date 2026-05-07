import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type PlanLimitKey =
  | "quizzes_per_day"
  | "ai_calls_per_day"
  | "participants_per_session"
  | "question_bank"
  | "sessions_total";

export type PlanInfo = {
  id: string;
  slug: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
  limits: Record<PlanLimitKey, number>;
  features: string[];
};

export type PlanUsage = {
  quizzes_today: number;
  ai_calls_today: number;
  questions_total: number;
  sessions_total: number;
};

type PlanContextValue = {
  plan: PlanInfo | null;
  usage: PlanUsage;
  loading: boolean;
  /** -1 = unlimited, otherwise remaining count */
  remaining: (key: PlanLimitKey) => number;
  /** true when limit is exhausted */
  isLocked: (key: PlanLimitKey) => boolean;
  /** percentage used 0-100 */
  usedPct: (key: PlanLimitKey) => number;
  reload: () => void;
};

const DEFAULT_FREE_LIMITS: Record<PlanLimitKey, number> = {
  quizzes_per_day: 5,
  ai_calls_per_day: 3,
  participants_per_session: 30,
  question_bank: 100,
  sessions_total: 20,
};

const PlanContext = createContext<PlanContextValue>({
  plan: null,
  usage: { quizzes_today: 0, ai_calls_today: 0, questions_total: 0, sessions_total: 0 },
  loading: true,
  remaining: () => 0,
  isLocked: () => false,
  usedPct: () => 0,
  reload: () => {},
});

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [usage, setUsage] = useState<PlanUsage>({
    quizzes_today: 0, ai_calls_today: 0, questions_total: 0, sessions_total: 0,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const today = new Date().toISOString().slice(0, 10) + "T00:00:00Z";

    const [subRes, quizzesToday, questionsTotal, sessionsTotal] = await Promise.all([
      supabase.from("user_subscriptions").select("*, plans(*)").eq("user_id", user.id).maybeSingle(),
      supabase.from("quiz_sessions").select("id", { count: "exact", head: true }).eq("owner_id", user.id).gte("created_at", today),
      supabase.from("questions").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
      supabase.from("quiz_sessions").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    ]);

    const raw = subRes.data?.plans as Record<string, unknown> | null;
    if (raw) {
      setPlan({
        id: raw.id as string,
        slug: raw.slug as string,
        name: raw.name as string,
        price_monthly: raw.price_monthly as number,
        price_yearly: raw.price_yearly as number,
        limits: { ...DEFAULT_FREE_LIMITS, ...(raw.limits as Record<PlanLimitKey, number>) },
        features: (raw.features as string[]) ?? [],
      });
    } else {
      setPlan({
        id: "", slug: "free", name: "Free",
        price_monthly: 0, price_yearly: 0,
        limits: { ...DEFAULT_FREE_LIMITS },
        features: [],
      });
    }

    setUsage({
      quizzes_today: quizzesToday.count ?? 0,
      ai_calls_today: 0,
      questions_total: questionsTotal.count ?? 0,
      sessions_total: sessionsTotal.count ?? 0,
    });
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const usedFor = (key: PlanLimitKey): number => {
    if (key === "quizzes_per_day")        return usage.quizzes_today;
    if (key === "ai_calls_per_day")       return usage.ai_calls_today;
    if (key === "question_bank")          return usage.questions_total;
    if (key === "sessions_total")         return usage.sessions_total;
    return 0;
  };

  const remaining = (key: PlanLimitKey): number => {
    if (!plan) return 0;
    const limit = plan.limits[key];
    if (limit === -1) return Infinity;
    return Math.max(0, limit - usedFor(key));
  };

  const isLocked = (key: PlanLimitKey): boolean => {
    if (!plan) return false;
    const limit = plan.limits[key];
    if (limit === -1) return false;
    return usedFor(key) >= limit;
  };

  const usedPct = (key: PlanLimitKey): number => {
    if (!plan) return 0;
    const limit = plan.limits[key];
    if (limit === -1) return 0;
    return Math.min(100, Math.round((usedFor(key) / limit) * 100));
  };

  return (
    <PlanContext.Provider value={{ plan, usage, loading, remaining, isLocked, usedPct, reload: load }}>
      {children}
    </PlanContext.Provider>
  );
}

export const usePlan = () => useContext(PlanContext);
