import { Zap } from "lucide-react";
import type { PlanInfo } from "@/contexts/PlanContext";

type Props = { plan: PlanInfo; isCurrent: boolean; onSelect: () => void };

export function PlanCard({ plan, isCurrent, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isCurrent}
      className={`rounded-2xl border p-5 text-left transition-all hover:shadow-glow group ${
        isCurrent
          ? "border-primary/50 bg-primary/5 cursor-default"
          : "border-border bg-card/40 hover:border-primary/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="font-semibold text-sm">{plan.name}</div>
        {isCurrent && (
          <span className="inline-flex items-center rounded-full bg-primary/20 text-primary px-2 py-0.5 text-[9px] font-bold shrink-0">
            Current
          </span>
        )}
      </div>
      {plan.description && (
        <p className="text-xs text-muted-foreground mb-3 leading-snug">{plan.description}</p>
      )}
      <div className="flex items-baseline gap-1 mb-1">
        <span className="font-display text-2xl font-bold">PKR {plan.price_pkr}</span>
        <span className="text-xs text-muted-foreground">/month</span>
      </div>
      {plan.credits_per_month > 0 && (
        <div className="text-xs text-warning font-semibold flex items-center gap-1 mb-3">
          <Zap className="size-3" /> {plan.credits_per_month} credits/month
        </div>
      )}
      {!isCurrent && (
        <div className="w-full text-center text-xs font-semibold text-primary bg-primary/10 rounded-xl py-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          Select →
        </div>
      )}
    </button>
  );
}
