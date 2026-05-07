/**
 * PlanGate — wraps any clickable area or content.
 * When the user's plan limit is exhausted for `feature`, clicking
 * anything inside opens the UpgradeModal instead of performing the action.
 */
import { useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { usePlan, type PlanLimitKey } from "@/contexts/PlanContext";
import { UpgradeModal } from "@/components/UpgradeModal";

const FEATURE_LABELS: Record<PlanLimitKey, string> = {
  quizzes_per_day:        "Daily quiz creation",
  ai_calls_per_day:       "AI question generation",
  participants_per_session: "Participants per session",
  question_bank:          "Question bank",
  sessions_total:         "Total sessions",
};

type Props = {
  feature: PlanLimitKey;
  children: ReactNode;
  /** Show a small lock badge on the wrapper */
  showBadge?: boolean;
};

export function PlanGate({ feature, children, showBadge = false }: Props) {
  const { isLocked } = usePlan();
  const [showModal, setShowModal] = useState(false);
  const locked = isLocked(feature);

  if (!locked) return <>{children}</>;

  return (
    <>
      <div
        className="relative"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowModal(true); }}
      >
        <div className="pointer-events-none opacity-50 select-none">{children}</div>
        {showBadge && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-xl bg-destructive/90 text-destructive-foreground text-xs font-semibold px-3 py-1.5 flex items-center gap-1.5 shadow-lg">
              <Lock className="h-3.5 w-3.5" /> Limit reached
            </div>
          </div>
        )}
      </div>
      <UpgradeModal
        open={showModal}
        onClose={() => setShowModal(false)}
        lockedFeature={FEATURE_LABELS[feature]}
      />
    </>
  );
}

/**
 * usePlanGate — imperative version. Call `checkGate(feature)` before
 * any async action; returns true if allowed, false + opens modal if locked.
 */
export function usePlanGate() {
  const { isLocked } = usePlan();
  const [modalFeature, setModalFeature] = useState<PlanLimitKey | null>(null);

  const checkGate = (feature: PlanLimitKey): boolean => {
    if (isLocked(feature)) {
      setModalFeature(feature);
      return false;
    }
    return true;
  };

  const modal = (
    <UpgradeModal
      open={!!modalFeature}
      onClose={() => setModalFeature(null)}
      lockedFeature={modalFeature ? FEATURE_LABELS[modalFeature] : undefined}
    />
  );

  return { checkGate, modal };
}
