import { useState } from "react";
import { ArrowLeft, Zap, Tag, CheckCircle, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { PlanInfo } from "@/contexts/PlanContext";
import { supabase } from "@/integrations/supabase/client";
import { StepHeader } from "./StepHeader";
import { METHOD_ICONS } from "./constants";
import { cyclePrice, type BillingCycle, type PaymentAccount } from "./types";

export type PromoResult = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed" | "free";
  discount_percent: number | null;
  discount_fixed_pkr: number | null;
  description: string | null;
};

type Props = {
  selectedPlan: PlanInfo;
  accounts: PaymentAccount[];
  onSelectMethod: (method: string, promo: PromoResult | null) => void;
  onFreePromo: (promo: PromoResult) => void;
  onBack: () => void;
  cycle: BillingCycle;
  yearlyDiscountPercent: number;
};

function applyDiscount(price: number, promo: PromoResult | null): number {
  if (!promo) return price;
  if (promo.discount_type === "free") return 0;
  if (promo.discount_type === "percent" && promo.discount_percent)
    return Math.max(0, Math.round(price * (1 - promo.discount_percent / 100)));
  if (promo.discount_type === "fixed" && promo.discount_fixed_pkr)
    return Math.max(0, price - promo.discount_fixed_pkr);
  return price;
}

export function PayStep({ selectedPlan, accounts, onSelectMethod, onFreePromo, onBack, cycle, yearlyDiscountPercent }: Props) {
  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promo, setPromo] = useState<PromoResult | null>(null);
  const [promoError, setPromoError] = useState("");

  const isCreditPack = selectedPlan.id.startsWith("__credit_pack__");
  const planSlug = isCreditPack ? "credits" : selectedPlan.slug ?? "";

  const validatePromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoLoading(true);
    setPromoError("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("validate_promo_code", {
      p_code: code,
      p_plan_slug: planSlug,
    });
    setPromoLoading(false);
    if (error || !data?.length) {
      setPromoError("Invalid, expired, or not applicable to this plan.");
      setPromo(null);
      return;
    }
    const result = data[0] as PromoResult;
    setPromo({ ...result, code });
    if (result.discount_type === "free") {
      toast.success("🎁 Free plan promo applied!");
    } else {
      toast.success("Promo code applied!");
    }
  };

  const clearPromo = () => {
    setPromo(null);
    setPromoInput("");
    setPromoError("");
  };

  const isCreditPackPrice = selectedPlan.id.startsWith("__credit_pack__");
  const originalPrice = isCreditPackPrice
    ? selectedPlan.price_pkr
    : cyclePrice(selectedPlan.price_pkr, cycle, yearlyDiscountPercent);
  const finalPrice = applyDiscount(originalPrice, promo);
  const saving = originalPrice - finalPrice;

  const discountLabel = () => {
    if (!promo) return null;
    if (promo.discount_type === "free") return "100% FREE";
    if (promo.discount_type === "percent") return `${promo.discount_percent}% off`;
    if (promo.discount_type === "fixed") return `PKR ${promo.discount_fixed_pkr} off`;
    return null;
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <StepHeader
        title="How would you like to pay?" aria-label="How would you like to pay?"
        sub={`${selectedPlan.name}${isCreditPackPrice ? "" : ` · ${cycle}`} · PKR ${finalPrice.toLocaleString()}`}
        onBack={onBack}
      />

      {/* Plan summary */}
      <div className="rounded-2xl border border-primary/25 bg-primary/5 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">{selectedPlan.name}</p>
            <p className="text-xs text-warning mt-0.5 flex items-center gap-1">
              <Zap className="size-3" /> {selectedPlan.credits_per_month} credits
            </p>
          </div>
          <div className="text-right">
            {promo && saving > 0 && (
              <p className="text-xs text-muted-foreground line-through">PKR {originalPrice.toLocaleString()}</p>
            )}
            <p className="font-display text-2xl font-bold">
              {finalPrice === 0 ? (
                <span className="text-success">FREE</span>
              ) : (
                `PKR ${finalPrice.toLocaleString()}`
              )}
            </p>
            {promo && saving > 0 && (
              <p className="text-[11px] text-success font-semibold">You save PKR {saving.toLocaleString()}</p>
            )}
          </div>
        </div>
      </div>

      {/* Promo code */}
      <div className="rounded-2xl border border-border bg-card/50 px-5 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <Tag className="size-4 text-primary" />
          <span className="text-sm font-semibold">Promo Code</span>
          <span className="text-xs text-muted-foreground">(optional)</span>
        </div>

        {promo ? (
          <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3">
            <CheckCircle className="size-5 text-success shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-success font-mono">{promo.code}</p>
              <p className="text-xs text-muted-foreground">
                {discountLabel()}{promo.description ? ` · ${promo.description}` : ""}
              </p>
            </div>
            <button type="button" title="Remove promo" aria-label="Remove promo" onClick={clearPromo} className="p-1 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter promo code…"
              value={promoInput}
              onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") void validatePromo(); }}
              className="flex-1 h-10 rounded-xl border border-input bg-background px-3 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/50"
              maxLength={30}
            />
            <button
              type="button"
              onClick={() => void validatePromo()}
              disabled={promoLoading || !promoInput.trim()}
              className="px-4 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              {promoLoading ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
            </button>
          </div>
        )}

        {promoError && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <X className="size-3" /> {promoError}
          </p>
        )}
      </div>

      {/* Free promo - skip payment */}
      {promo?.discount_type === "free" ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-success/30 bg-success/5 px-5 py-4 text-center space-y-2">
            <p className="text-2xl">🎁</p>
            <p className="font-semibold text-success">This plan is FREE with your promo code!</p>
            <p className="text-xs text-muted-foreground">Click below to activate it instantly. No payment required.</p>
          </div>
          <button
            type="button"
            onClick={() => onFreePromo(promo)}
            className="w-full h-12 rounded-2xl bg-success text-white font-bold text-sm hover:bg-success/90 transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="size-5" /> Activate Free Plan
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Select a payment method
          </p>
          {accounts.map((acc) => (
            <button
              key={acc.id}
              type="button"
              onClick={() => onSelectMethod(acc.method, promo)}
              className="w-full rounded-2xl border border-border bg-card/50 p-4 flex items-center gap-4 hover:border-primary/50 hover:shadow-glow transition-all min-h-[72px] text-left"
            >
              <span className="text-3xl shrink-0">{METHOD_ICONS[acc.method] ?? "💳"}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{acc.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{acc.account_number}</p>
              </div>
              <ArrowLeft className="size-4 text-muted-foreground rotate-180 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
