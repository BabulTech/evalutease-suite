import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureSelectedPlan } from "@/lib/plan.server";
import { FREE_PLAN, rowToPlan } from "./planData";
import type { PlanInfo, CreditInfo, PlanUsage } from "./types";

type Setters = {
  setPlan: (p: PlanInfo) => void;
  setAllPlans: (p: PlanInfo[]) => void;
  setCredits: (c: CreditInfo) => void;
  setUsage: (u: PlanUsage) => void;
  setExpiresAt: (v: string | null) => void;
  setLoading: (v: boolean) => void;
};

type LoaderDeps = {
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null;
  hostInfo: { admin_user_id: string } | null;
  hostLoading: boolean;
};

export function usePlanLoader(deps: LoaderDeps, setters: Setters) {
  const { user, hostInfo, hostLoading } = deps;
  const { setPlan, setAllPlans, setCredits, setUsage, setExpiresAt, setLoading } = setters;

  return useCallback(async () => {
    if (!user || hostLoading) return;
    setLoading(true);

    const today = new Date().toISOString().slice(0, 10) + "T00:00:00Z";
    const planOwnerId = hostInfo?.admin_user_id ?? user.id;

    const [
      subRes,
      creditsRes,
      allPlansRes,
      quizzesToday,
      questionsTotal,
      participantsTotal,
      sessionsTotal,
    ] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("user_subscriptions")
        .select("*, plans(*)")
        .eq("user_id", planOwnerId)
        .eq("status", "active")
        .maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("user_credits")
        .select("balance, total_earned, total_spent")
        .eq("user_id", user.id)
        .maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("plans").select("*").eq("is_active", true).order("sort_order"),
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

    if (allPlansRes.data) {
      setAllPlans((allPlansRes.data as Record<string, unknown>[]).map(rowToPlan));
    }

    if (creditsRes.data) {
      setCredits({
        balance: creditsRes.data.balance ?? 0,
        total_earned: creditsRes.data.total_earned ?? 0,
        total_spent: creditsRes.data.total_spent ?? 0,
      });
    }

    const sub = subRes.data;
    const planRaw = sub?.plans as Record<string, unknown> | null;
    const expiry = (sub?.expires_at as string | null) ?? null;
    setExpiresAt(hostInfo ? null : expiry);
    const isExpiredSub = hostInfo ? false : expiry ? new Date(expiry) < new Date() : false;
    setPlan(planRaw && !isExpiredSub ? rowToPlan(planRaw) : { ...FREE_PLAN });

    if (!hostInfo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("selected_plan")
        .eq("id", user.id)
        .maybeSingle();
      const metadataPlan = user.user_metadata?.selected_plan as string | undefined;
      const pendingPlan =
        typeof window !== "undefined" ? window.localStorage.getItem("pending_signup_plan") : null;
      const wanted = [pendingPlan, metadataPlan, profile?.selected_plan].find(
        (slug): slug is "individual_starter" | "enterprise_starter" =>
          slug === "individual_starter" || slug === "enterprise_starter",
      );
      const current = (planRaw as { slug?: string } | null)?.slug ?? null;
      if (wanted && wanted !== current) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (token) {
            await ensureSelectedPlan({ data: { planSlug: wanted, _token: token } });
            if (typeof window !== "undefined")
              window.localStorage.removeItem("pending_signup_plan");
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: fixed } = await (supabase as any)
              .from("user_subscriptions")
              .select("*, plans(*)")
              .eq("user_id", user.id)
              .eq("status", "active")
              .maybeSingle();
            if (fixed?.plans) {
              setPlan(rowToPlan(fixed.plans as Record<string, unknown>));
              setExpiresAt((fixed.expires_at as string | null) ?? null);
            }
          }
        } catch (error) {
          console.warn("Plan repair failed", error);
        }
      }
    }

    setUsage({
      quizzes_today: quizzesToday.count ?? 0,
      questions_total: questionsTotal.count ?? 0,
      participants_total: participantsTotal.count ?? 0,
      sessions_total: sessionsTotal.count ?? 0,
    });

    setLoading(false);
  }, [
    user,
    hostInfo,
    hostLoading,
    setPlan,
    setAllPlans,
    setCredits,
    setExpiresAt,
    setUsage,
    setLoading,
  ]);
}
