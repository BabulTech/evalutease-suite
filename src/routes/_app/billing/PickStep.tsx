import { Zap, Building2, Coins } from "lucide-react";
import type { PlanInfo } from "@/contexts/PlanContext";
import { StepHeader } from "./StepHeader";
import { PlanCard } from "./PlanCard";
import type { CreditPackage, PickMode, BillingCycle } from "./types";

type Props = {
  pickMode: PickMode;
  canBuyCredits: boolean;
  creditPacks: CreditPackage[];
  individualPlans: PlanInfo[];
  enterprisePlans: PlanInfo[];
  currentPlanSlug: string | undefined;
  onSelectPack: (pack: CreditPackage) => void;
  onSelectPlan: (plan: PlanInfo) => void;
  onUpgradePlan: () => void;
  onBack: () => void;
  cycle: BillingCycle;
  onCycleChange: (c: BillingCycle) => void;
  yearlyDiscountPercent: number;
};

export function PickStep({
  pickMode,
  canBuyCredits,
  creditPacks,
  individualPlans,
  enterprisePlans,
  currentPlanSlug,
  onSelectPack,
  onSelectPlan,
  onUpgradePlan,
  onBack,
  cycle,
  onCycleChange,
  yearlyDiscountPercent,
}: Props) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <StepHeader
        title={pickMode === "pack" ? "Buy Extra Credits" : "Choose a Plan"}
        sub={
          pickMode === "pack"
            ? "Credits never expire and stack with your monthly allocation"
            : `Billed ${cycle} · cancel anytime`
        }
        onBack={onBack}
      />

      {pickMode === "plan" && (
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1 p-1 rounded-full border border-border bg-card/50">
            <button
              type="button"
              onClick={() => onCycleChange("monthly")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                cycle === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => onCycleChange("yearly")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                cycle === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Yearly
              {yearlyDiscountPercent > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  cycle === "yearly" ? "bg-primary-foreground/20" : "bg-success/15 text-success"
                }`}>
                  -{yearlyDiscountPercent}%
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {pickMode === "pack" ? (
        <div className="grid grid-cols-2 gap-3">
          {!canBuyCredits && (
            <div className="col-span-2 rounded-2xl border border-warning/30 bg-warning/5 p-5 text-center space-y-2">
              <Coins className="size-8 text-warning mx-auto" />
              <p className="font-semibold text-sm">
                Add-on credits require Individual Pro or Enterprise Pro
              </p>
              <button
                type="button"
                onClick={onUpgradePlan}
                className="text-xs text-primary underline"
              >
                Upgrade your plan →
              </button>
            </div>
          )}
          {canBuyCredits && creditPacks.length === 0 && (
            <div className="col-span-2 text-center text-muted-foreground text-sm py-8">
              No credit packages available right now.
            </div>
          )}
          {canBuyCredits &&
            creditPacks.map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => onSelectPack(pack)}
                className="relative rounded-2xl border border-border bg-card/50 p-5 text-left hover:border-primary/50 hover:shadow-glow transition-all group flex flex-col gap-1"
              >
                {pack.badge_text && (
                  <span className="absolute -top-2 left-4 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                    {pack.badge_text}
                  </span>
                )}
                <span className="font-display text-3xl font-bold text-warning">{pack.credits}</span>
                <span className="text-xs text-muted-foreground">credits</span>
                <span className="mt-2 font-bold text-lg">PKR {pack.price_pkr}</span>
                <span className="text-[11px] text-muted-foreground">
                  {pack.name} · PKR {(pack.price_pkr / pack.credits).toFixed(2)}/cr
                </span>
                <span className="mt-3 w-full text-center text-xs font-semibold text-primary bg-primary/10 rounded-lg py-1.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  Buy →
                </span>
              </button>
            ))}
        </div>
      ) : (
        <div className="space-y-4">
          {individualPlans.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground mb-2">
                <Zap className="size-3.5" /> Individual
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {individualPlans.map((p) => (
                  <PlanCard
                    key={p.id}
                    plan={p}
                    isCurrent={currentPlanSlug === p.slug}
                    onSelect={() => onSelectPlan(p)}
                    cycle={cycle}
                    discountPct={yearlyDiscountPercent}
                  />
                ))}
              </div>
            </div>
          )}
          {enterprisePlans.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground mb-2">
                <Building2 className="size-3.5" /> Enterprise / School
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {enterprisePlans.map((p) => (
                  <PlanCard
                    key={p.id}
                    plan={p}
                    isCurrent={currentPlanSlug === p.slug}
                    onSelect={() => onSelectPlan(p)}
                    cycle={cycle}
                    discountPct={yearlyDiscountPercent}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
