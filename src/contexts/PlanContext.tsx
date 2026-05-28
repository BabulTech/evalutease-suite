import { createContext, use, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useHost } from "@/contexts/HostContext";
import { FREE_PLAN } from "./plan-context/planData";
import { usePlanLoader } from "./plan-context/usePlanLoader";
import { makeLimitHelpers } from "./plan-context/planLimits";
import type { PlanInfo, CreditInfo, PlanUsage, PlanContextValue } from "./plan-context/types";

export type {
  PlanSlug,
  PlanTier,
  PlanInfo,
  CreditInfo,
  PlanUsage,
  PlanLimits,
} from "./plan-context/types";

const PlanContext = createContext<PlanContextValue>({
  plan: null,
  credits: { balance: 0, total_earned: 0, total_spent: 0 },
  usage: { quizzes_today: 0, questions_total: 0, participants_total: 0, sessions_total: 0 },
  loading: true,
  isAiAllowed: false,
  isExpired: false,
  daysUntilExpiry: null,
  expiresAt: null,
  billingCycle: "monthly",
  isLocked: () => false,
  remaining: () => 0,
  usedPct: () => 0,
  reload: () => {},
  allPlans: [],
  yearlyDiscountPercent: 10,
});

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function PlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { hostInfo, loading: hostLoading } = useHost();
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [allPlans, setAllPlans] = useState<PlanInfo[]>([]);
  const [credits, setCredits] = useState<CreditInfo>({
    balance: 0,
    total_earned: 0,
    total_spent: 0,
  });
  const [usage, setUsage] = useState<PlanUsage>({
    quizzes_today: 0,
    questions_total: 0,
    participants_total: 0,
    sessions_total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [yearlyDiscountPercent, setYearlyDiscount] = useState(10);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const load = usePlanLoader(
    { user, hostInfo, hostLoading },
    { setPlan, setAllPlans, setCredits, setUsage, setExpiresAt, setLoading, setYearlyDiscount, setBillingCycle },
  );

  useEffect(() => {
    void load();
  }, [load]);

  const currentPlan = plan ?? FREE_PLAN;
  const { remaining, isLocked, usedPct } = makeLimitHelpers(currentPlan, usage);

  const isPaidPlan = !["free", "individual_starter", "enterprise_free"].includes(currentPlan.slug);
  // enterprise_free gets a lifetime allocation (plan.trial_ai_calls). Let them
  // into the AI tab - the server-side consumeFreeAiCall() guard enforces the cap.
  const hasFreeAiAllowance = (currentPlan.trial_ai_calls ?? 0) > 0;
  const isAiAllowed = !!hostInfo || currentPlan.ai_enabled || isPaidPlan || hasFreeAiAllowance;
  const isExpired = expiresAt ? new Date(expiresAt) < new Date() : false;
  const daysUntilExpiry = expiresAt
    ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
    : null;

  const ctxValue = useMemo(
    () => ({
      plan: currentPlan,
      credits,
      usage,
      loading,
      isAiAllowed,
      isExpired,
      daysUntilExpiry,
      expiresAt,
      billingCycle,
      isLocked,
      remaining,
      usedPct,
      reload: load,
      allPlans,
      yearlyDiscountPercent,
    }),
    [
      currentPlan,
      credits,
      usage,
      loading,
      isAiAllowed,
      isExpired,
      daysUntilExpiry,
      expiresAt,
      billingCycle,
      isLocked,
      remaining,
      usedPct,
      load,
      allPlans,
      yearlyDiscountPercent,
    ],
  );

  return <PlanContext.Provider value={ctxValue}>{children}</PlanContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- standard context+hook co-location
export const usePlan = () => use(PlanContext);
