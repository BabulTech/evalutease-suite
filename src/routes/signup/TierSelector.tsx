import { useEffect, useState } from "react";
import { Check, ChevronRight, ChevronLeft, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { rowToPlan } from "@/contexts/plan-context/planData";
import type { PlanInfo } from "@/contexts/PlanContext";

interface TierSelectorProps {
  category: string;
  selectedTier: string;
  isNgo: boolean;
  cycle: "monthly" | "yearly";
  onSelect: (tier: string) => void;
  onNgoChange: (v: boolean) => void;
  onCycleChange: (c: "monthly" | "yearly") => void;
  onContinue: () => void;
  onBack: () => void;
}

const POPULAR_SLUGS = ["individual_pro", "enterprise_pro"];

export function TierSelector({
  category,
  selectedTier,
  isNgo,
  cycle,
  onSelect,
  onNgoChange,
  onCycleChange,
  onContinue,
  onBack,
}: TierSelectorProps) {
  const [allPlans, setAllPlans] = useState<PlanInfo[]>([]);
  const [yearlyDiscountPercent, setYearlyDiscountPercent] = useState(10);

  useEffect(() => {
    // Signup runs anonymously — read plans through the curated RPC, which
    // returns marketing fields only (no internal credit_cost_* economics).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase as any)
      .rpc("get_public_plans")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: { data: Record<string, unknown>[] | null }) => {
        if (data) setAllPlans(data.map(rowToPlan));
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (supabase as any)
      .from("app_settings")
      .select("yearly_discount_percent")
      .eq("id", true)
      .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => {
        if (data?.yearly_discount_percent != null) setYearlyDiscountPercent(data.yearly_discount_percent);
      });
  }, []);

  const tier = category === "enterprise" ? "enterprise" : "individual";
  // Only show the canonical free + pro slugs - exclude legacy slugs like enterprise_free
  const ALLOWED_SLUGS =
    category === "enterprise"
      ? ["enterprise_free", "enterprise_pro"]
      : ["individual_starter", "individual_pro"];
  const plans = allPlans.filter((p) => p.tier === tier && ALLOWED_SLUGS.includes(p.slug));
  const plan = plans.find((p) => p.slug === selectedTier) ?? plans[0];
  const isFree = plan ? plan.price_pkr === 0 : true;
  const isPopular = plan ? POPULAR_SLUGS.includes(plan.slug) : false;
  const ngoDiscountActive = isNgo && plan && !isFree;
  const ngoMonthlyPrice = ngoDiscountActive && plan ? Math.floor(plan.price_pkr / 2) : plan?.price_pkr ?? 0;
  const yearlyTotal = !isFree && plan
    ? Math.round(ngoMonthlyPrice * 12 * (1 - yearlyDiscountPercent / 100))
    : 0;
  const yearlyEffectiveMonthly = !isFree ? Math.round(yearlyTotal / 12) : 0;
  const yearlySavings = !isFree && plan ? (ngoMonthlyPrice * 12) - yearlyTotal : 0;
  const displayPrice = isFree
    ? 0
    : cycle === "yearly"
      ? yearlyEffectiveMonthly
      : ngoMonthlyPrice;

  if (plans.length === 0) {
    return (
      <div className="space-y-3">
        <div className="h-10 rounded-2xl bg-muted/30 animate-pulse" />
        <div className="h-56 rounded-2xl bg-muted/30 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Toggle tabs */}
      <div className="flex p-1 gap-1 bg-secondary/50 rounded-2xl">
        {plans.map((p) => {
          const active = selectedTier === p.slug;
          const isPop = POPULAR_SLUGS.includes(p.slug);
          return (
            <button
              key={p.slug}
              type="button"
              onClick={() => {
                onSelect(p.slug);
                // Free has no NGO discount — clear any stale NGO selection.
                if (p.price_pkr === 0 && isNgo) onNgoChange(false);
              }}
              className={`relative flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                active
                  ? isPop
                    ? "bg-emerald-400 text-black shadow"
                    : "bg-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isPop && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-primary text-primary-foreground shadow-glow whitespace-nowrap">
                  Popular
                </span>
              )}
              {p.price_pkr === 0
                ? "Free"
                : isNgo
                  ? `Pro · PKR ${Math.floor(p.price_pkr / 2).toLocaleString()}`
                  : `Pro · PKR ${p.price_pkr.toLocaleString()}`}
            </button>
          );
        })}
      </div>

      {/* Billing cycle toggle (hidden if selected plan is free) */}
      {!isFree && (
        <div className="flex justify-center">
          <div className="inline-flex p-1 rounded-full bg-secondary/50 border border-border">
            {(["monthly", "yearly"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCycleChange(c)}
                className={`relative px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  cycle === c
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {c === "monthly" ? "Monthly" : "Yearly"}
                {c === "yearly" && yearlyDiscountPercent > 0 && (
                  <span
                    className={`ml-1.5 inline-block rounded-full text-[9px] font-bold px-1.5 py-0.5 align-middle ${
                      cycle === "yearly"
                        ? "bg-white/25 text-white"
                        : "bg-emerald-400/20 text-emerald-400"
                    }`}
                  >
                    -{yearlyDiscountPercent}%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected plan detail card */}
      {plan && (
        <div
          className={`rounded-2xl border p-5 transition-all ${
            isPopular
              ? "border-emerald-400/50 bg-emerald-400/5"
              : "border-primary/40 bg-primary/5"
          }`}
        >
          <div className="mb-3">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className={`font-display text-2xl font-bold ${isPopular ? "text-emerald-400" : "text-primary"}`}>
                {isFree ? "Free" : `PKR ${displayPrice.toLocaleString()}`}
              </span>
              {!isFree && <span className="text-xs text-muted-foreground">/month</span>}
              {ngoDiscountActive && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-400">
                  NGO 50% off
                </span>
              )}
            </div>
            {!isFree && cycle === "yearly" && (
              <p className="text-[11px] text-muted-foreground mt-1">
                <span className="line-through">PKR {ngoMonthlyPrice.toLocaleString()}/mo</span>
                {" · billed yearly: "}
                <span className="font-semibold text-foreground">PKR {yearlyTotal.toLocaleString()}</span>
              </p>
            )}
            {!isFree && cycle === "yearly" && yearlySavings > 0 && (
              <p className="text-[11px] mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-400/15 text-emerald-400 px-2 py-0.5 font-semibold">
                💰 Save PKR {yearlySavings.toLocaleString()} / year
              </p>
            )}
            {plan.description && !isFree && (
              <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
            )}
          </div>

          {plan.credits_per_month > 0 && !isFree && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-warning mb-3 bg-warning/10 rounded-xl px-3 py-2">
              <Zap size={12} />
              {plan.credits_per_month} credits / month
              {cycle === "yearly" && " · auto-refilled each month"}
            </div>
          )}

          {plan.trial_ai_calls > 0 && isFree && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-success mb-3 bg-success/10 rounded-xl px-3 py-2">
              <Zap size={12} /> {plan.trial_ai_calls} free AI calls (lifetime gift)
            </div>
          )}

          <ul className="space-y-2 mb-4">
            {plan.features_list
              // Drop the "complimentary AI calls" line — it duplicates the
              // "free AI calls (lifetime gift)" badge shown above.
              .filter((f) => !/complimentary ai calls/i.test(f))
              .map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check size={13} className={`mt-0.5 shrink-0 ${isPopular ? "text-emerald-400" : "text-primary"}`} />
                {f}
              </li>
            ))}
          </ul>

          {!isFree && (
            <p className="text-[11px] text-yellow-400/80 flex items-center gap-1.5 bg-yellow-400/5 rounded-xl px-3 py-2">
              <Zap size={10} /> Payment screenshot required — activated within a moment
            </p>
          )}
        </div>
      )}

      {/* NGO toggle - enterprise paid only (50% off makes no sense on Free) */}
      {category === "enterprise" && !isFree && (
        <button
          type="button"
          onClick={() => onNgoChange(!isNgo)}
          className={`w-full flex items-center gap-3 rounded-2xl border p-4 transition-all text-left ${
            isNgo
              ? "border-emerald-400/60 bg-emerald-400/5 ring-2 ring-emerald-400/30"
              : "border-border bg-secondary/20 hover:border-emerald-400/40"
          }`}
        >
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
              isNgo ? "border-emerald-400 bg-emerald-400" : "border-border"
            }`}
          >
            {isNgo && <Check size={11} className="text-white" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
              <Sparkles size={13} /> We are an NGO / Non-profit
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              50% off on Pro · PKR 2,499/month (requires certificate verification)
            </p>
          </div>
        </button>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-12 px-4" onClick={onBack}>
          <ChevronLeft size={16} />
        </Button>
        <Button
          type="button"
          className="flex-1 h-12 bg-gradient-primary font-semibold shadow-glow text-base"
          onClick={onContinue}
          disabled={!selectedTier}
        >
          Continue <ChevronRight size={16} className="ml-1" />
        </Button>
      </div>

    </div>
  );
}
