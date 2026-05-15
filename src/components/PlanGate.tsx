/**
 * PlanGate — wraps content that requires a plan limit or AI access.
 * Shows a lock overlay when limit is reached.
 * No Stripe — directs user to manual payment page.
 */
import { type ReactNode } from "react";
import { Lock, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { usePlan, type PlanLimits } from "@/contexts/PlanContext";

const LIMIT_LABELS: Record<keyof PlanLimits, string> = {
  quizzes_per_day:          "Daily quiz limit",
  participants_per_session: "Participants per session",
  participants_total:       "Total participants",
  question_bank:            "Question bank",
  sessions_total:           "Total sessions",
};

// ─── Hard limit gate ────────────────────────────────────────────
type LimitGateProps = {
  feature: keyof PlanLimits;
  children: ReactNode;
  showBadge?: boolean;
};

export function PlanGate({ feature, children, showBadge = false }: LimitGateProps) {
  const { isLocked } = usePlan();
  if (!isLocked(feature)) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40 select-none">{children}</div>
      {showBadge && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Link
            to="/settings"
            search={{ tab: "plan" } as Record<string, string>}
            className="rounded-xl bg-primary/90 text-primary-foreground text-xs font-semibold px-3 py-1.5 flex items-center gap-1.5 shadow-lg hover:bg-primary transition-colors"
          >
            <Lock className="h-3.5 w-3.5" /> {LIMIT_LABELS[feature]} reached — Upgrade
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── AI feature gate ─────────────────────────────────────────────
type AiGateProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export function AiGate({ children, fallback }: AiGateProps) {
  const { isAiAllowed } = usePlan();
  if (isAiAllowed) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  return (
    <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-6 text-center">
      <Zap className="mx-auto h-8 w-8 text-primary/50 mb-2" />
      <p className="text-sm font-semibold">AI features require a paid plan</p>
      <p className="text-xs text-muted-foreground mt-1 mb-4">
        Upgrade to Pro or higher to unlock unlimited AI question generation, OCR scanning, and more.
      </p>
      <Link
        to="/settings"
        search={{ tab: "plan" } as Record<string, string>}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 hover:bg-primary/90 transition-colors"
      >
        <Zap className="h-4 w-4" /> View Plans
      </Link>
    </div>
  );
}

// ─── Imperative hook ─────────────────────────────────────────────
export function usePlanGate() {
  const { isLocked, isAiAllowed } = usePlan();

  const checkLimit = (feature: keyof PlanLimits): boolean => !isLocked(feature);
  const checkAi = (): boolean => isAiAllowed;

  return { checkLimit, checkAi };
}
