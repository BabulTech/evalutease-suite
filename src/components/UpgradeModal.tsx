import { useEffect, useState } from "react";
import {
  X, Check, Zap, Star, Building2, Tag, ArrowRight, Sparkles, Lock, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePlan } from "@/contexts/PlanContext";
import { useAuth } from "@/lib/auth";

type DbPlan = {
  id: string; slug: string; name: string; description: string | null;
  price_monthly: number; price_yearly: number;
  features: string[]; limits: Record<string, number>;
  stripe_price_id_monthly: string | null; stripe_price_id_yearly: string | null;
};

type PromoResult = {
  id: string; code: string; discount_percent: number | null;
  discount_fixed_cents: number | null; applies_to_slugs: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Which feature triggered the lock — shown in the header */
  lockedFeature?: string;
  /** Pre-select a plan to upgrade to */
  targetSlug?: string;
};

const PLAN_ICONS: Record<string, React.ElementType> = {
  free: Zap, pro: Star, enterprise: Building2,
};
const PLAN_COLORS: Record<string, string> = {
  free: "text-muted-foreground", pro: "text-primary", enterprise: "text-warning",
};
const PLAN_GLOW: Record<string, string> = {
  pro: "border-primary/60 shadow-glow", enterprise: "border-warning/60",
};

function finalPrice(plan: DbPlan, billing: "monthly" | "yearly", promo: PromoResult | null): number {
  const base = billing === "yearly" ? plan.price_yearly : plan.price_monthly;
  if (!promo) return base;
  if (promo.discount_percent) return +(base * (1 - promo.discount_percent / 100)).toFixed(2);
  if (promo.discount_fixed_cents) return Math.max(0, base - promo.discount_fixed_cents / 100);
  return base;
}

export function UpgradeModal({ open, onClose, lockedFeature, targetSlug }: Props) {
  const { plan: currentPlan } = usePlan();
  const { user } = useAuth();
  const [plans, setPlans]   = useState<DbPlan[]>([]);
  const [selected, setSelected] = useState<string>(targetSlug ?? "pro");
  const [billing, setBilling]   = useState<"monthly" | "yearly">("monthly");
  const [promoCode, setPromoCode] = useState("");
  const [promo, setPromo]         = useState<PromoResult | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [upgrading, setUpgrading]       = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from("plans").select("*").eq("is_active", true).order("sort_order")
      .then(({ data }) => {
        if (data) setPlans(data.map((p) => ({
          ...p,
          features: (p.features as string[]) ?? [],
          limits: (p.limits as Record<string, number>) ?? {},
        })));
      });
    if (targetSlug) setSelected(targetSlug);
  }, [open, targetSlug]);

  const validatePromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    setPromoLoading(true);
    const { data } = await supabase.from("promo_codes")
      .select("id,code,discount_percent,discount_fixed_cents,applies_to_slugs")
      .eq("code", code).eq("is_active", true).maybeSingle();
    setPromoLoading(false);
    if (!data) { toast.error("Invalid or expired promo code"); return; }
    const result = data as unknown as PromoResult;
    const slugs = result.applies_to_slugs ?? [];
    if (slugs.length > 0 && !slugs.includes(selected)) {
      toast.error(`Code "${code}" is not valid for the ${selected} plan`); return;
    }
    setPromo(result);
    toast.success(`Promo applied — ${data.discount_percent ? `${data.discount_percent}% off` : `$${((data.discount_fixed_cents ?? 0) / 100).toFixed(2)} off`}`);
  };

  const handleUpgrade = async () => {
    const plan = plans.find((p) => p.slug === selected);
    if (!plan || !user) return;
    if (plan.price_monthly === 0) { toast.info("You're already on the Free plan"); return; }

    const priceId = (billing === "yearly" ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly)?.trim();
    if (!priceId) {
      toast.error(`No Stripe price set for ${plan.name} (${billing}).`, {
        description: "Admin: go to Admin → Plans → Edit the plan and save it to auto-generate Stripe prices.",
      });
      return;
    }

    setUpgrading(true);
    try {
      const { createCheckoutSession } = await import("@/integrations/stripe/stripe.server");
      const origin = window.location.origin;
      const result = await createCheckoutSession({
        data: {
          userId: user.id,
          priceId,
          planSlug: plan.slug,
          promoCode: promo?.code,
          successUrl: `${origin}/settings?tab=plan&upgraded=1`,
          cancelUrl: `${origin}/settings?tab=plan`,
        },
      });
      if (result.url) window.location.href = result.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setUpgrading(false);
    }
  };

  const handlePortal = async () => {
    if (!user) return;
    setPortalLoading(true);
    try {
      const { createPortalSession } = await import("@/integrations/stripe/stripe.server");
      const result = await createPortalSession({
        data: { userId: user.id, returnUrl: window.location.href },
      });
      if (result.url) window.location.href = result.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  if (!open) return null;

  const selectedPlan = plans.find((p) => p.slug === selected);
  const price = selectedPlan ? finalPrice(selectedPlan, billing, promo) : 0;
  const originalPrice = selectedPlan
    ? (billing === "yearly" ? selectedPlan.price_yearly : selectedPlan.price_monthly)
    : 0;
  const hasDiscount = promo && price < originalPrice;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-card shadow-elegant">

        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur rounded-t-3xl border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-primary p-2 shadow-glow">
              <Lock className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display font-bold text-lg">Upgrade Your Plan</div>
              {lockedFeature && (
                <div className="text-xs text-muted-foreground">
                  <span className="text-destructive font-medium">{lockedFeature}</span> is locked on your current plan
                </div>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-xl p-1.5 hover:bg-muted/40 transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm ${billing === "monthly" ? "text-foreground font-medium" : "text-muted-foreground"}`}>Monthly</span>
            <button type="button"
              onClick={() => setBilling((b) => b === "monthly" ? "yearly" : "monthly")}
              className={`relative h-6 w-11 rounded-full transition-colors ${billing === "yearly" ? "bg-primary" : "bg-muted"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${billing === "yearly" ? "left-5.5" : "left-0.5"}`} />
            </button>
            <span className={`text-sm ${billing === "yearly" ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              Yearly <Badge className="bg-success/15 text-success border-0 text-[10px] ml-1">Save ~30%</Badge>
            </span>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {plans.map((plan) => {
              const Icon = PLAN_ICONS[plan.slug] ?? Zap;
              const isCurrent = currentPlan?.slug === plan.slug;
              const isSelected = selected === plan.slug;
              const p = finalPrice(plan, billing, promo);
              const orig = billing === "yearly" ? plan.price_yearly : plan.price_monthly;
              const discounted = promo && p < orig;

              return (
                <button key={plan.slug} type="button"
                  onClick={() => { setSelected(plan.slug); setPromo(null); setPromoCode(""); }}
                  className={`relative rounded-2xl border p-4 text-left flex flex-col gap-3 transition-all duration-200 hover:scale-[1.02] ${
                    isSelected
                      ? `${PLAN_GLOW[plan.slug] ?? "border-primary/60 shadow-glow"} bg-primary/5`
                      : "border-border bg-card/40 hover:border-primary/30"
                  }`}>
                  {isCurrent && (
                    <span className="absolute -top-2.5 left-3 rounded-full bg-muted text-muted-foreground text-[9px] font-bold uppercase tracking-wider px-2 py-0.5">
                      Current
                    </span>
                  )}
                  {plan.slug === "pro" && (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-gradient-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 shadow-glow">
                      Popular
                    </span>
                  )}

                  <div className="flex items-center gap-2">
                    <div className={`rounded-xl p-2 ${isSelected ? "bg-primary/20" : "bg-muted/40"}`}>
                      <Icon className={`h-4 w-4 ${PLAN_COLORS[plan.slug]}`} />
                    </div>
                    <span className="font-display font-bold">{plan.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-primary ml-auto" />}
                  </div>

                  <div>
                    {discounted ? (
                      <div>
                        <span className="text-xs line-through text-muted-foreground">${orig}</span>
                        <div className="font-display text-2xl font-bold text-success">${p}<span className="text-xs text-muted-foreground font-normal">/{billing === "yearly" ? "yr" : "mo"}</span></div>
                      </div>
                    ) : (
                      <div className="font-display text-2xl font-bold">
                        {plan.price_monthly === 0 ? "Free" : `$${p}`}
                        {plan.price_monthly > 0 && <span className="text-xs text-muted-foreground font-normal">/{billing === "yearly" ? "yr" : "mo"}</span>}
                      </div>
                    )}
                  </div>

                  <ul className="space-y-1 flex-1">
                    {plan.features.slice(0, 4).map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <Check className="h-3 w-3 text-success mt-0.5 shrink-0" />{f}
                      </li>
                    ))}
                    {plan.features.length > 4 && (
                      <li className="text-[11px] text-muted-foreground pl-4">+{plan.features.length - 4} more</li>
                    )}
                  </ul>
                </button>
              );
            })}
          </div>

          {/* Promo code */}
          <div className="rounded-2xl border border-border bg-card/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Have a promo code?</span>
              {promo && <Badge className="bg-success/15 text-success border-0 text-[10px] ml-auto gap-1"><Check className="h-3 w-3" /> {promo.code} applied</Badge>}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Enter code (e.g. WELCOME20)"
                value={promoCode}
                onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromo(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") void validatePromo(); }}
                className="font-mono text-sm uppercase"
              />
              <Button variant="outline" onClick={() => void validatePromo()} disabled={promoLoading || !promoCode.trim()} className="shrink-0">
                {promoLoading ? "…" : "Apply"}
              </Button>
            </div>
            {promo && (
              <p className="text-xs text-success mt-2">
                ✓ {promo.discount_percent ? `${promo.discount_percent}% discount` : `$${((promo.discount_fixed_cents ?? 0) / 100).toFixed(2)} off`} applied
              </p>
            )}
          </div>

          {/* CTA */}
          {selectedPlan && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="font-semibold text-sm">
                  {selectedPlan.name} — {billing === "yearly" ? "Yearly" : "Monthly"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {hasDiscount
                    ? <><span className="line-through">${originalPrice}</span> → <span className="text-success font-semibold">${price}</span></>
                    : selectedPlan.price_monthly === 0 ? "Free forever" : `$${price}/${billing === "yearly" ? "yr" : "mo"}`
                  }
                </div>
              </div>
              {selectedPlan.slug !== currentPlan?.slug ? (
                <Button
                  onClick={() => void handleUpgrade()}
                  disabled={upgrading}
                  className="bg-gradient-primary text-primary-foreground shadow-glow gap-2 px-6"
                >
                  <Sparkles className="h-4 w-4" />
                  {upgrading ? "Redirecting to Stripe…" : `Upgrade to ${selectedPlan.name}`}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Badge className="bg-success/15 text-success border-0">You're on this plan</Badge>
              )}
            </div>
          )}

          {currentPlan && currentPlan.slug !== "free" && (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground text-xs"
                onClick={() => void handlePortal()} disabled={portalLoading}>
                <ExternalLink className="h-3.5 w-3.5" />
                {portalLoading ? "Opening portal…" : "Manage billing & invoices"}
              </Button>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Secure payments via Stripe · Cancel anytime · No hidden fees
          </p>
        </div>
      </div>
    </div>
  );
}
