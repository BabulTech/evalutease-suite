import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePlan, type PlanInfo } from "@/contexts/PlanContext";
import { useHost } from "@/contexts/HostContext";
import { FREE_SLUGS } from "./billing/constants";
import { useBillingData } from "./billing/useBillingData";
import { HostBillingView } from "./billing/HostBillingView";
import { OverviewStep } from "./billing/OverviewStep";
import { PickStep } from "./billing/PickStep";
import { PayStep, type PromoResult } from "./billing/PayStep";
import { UploadStep } from "./billing/UploadStep";
import { DoneStep } from "./billing/DoneStep";
import { cyclePrice, type BillingStep, type PickMode, type CreditPackage, type BillingCycle } from "./billing/types";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/_app/billing")({
  validateSearch: (s: Record<string, unknown>) => ({
    plan: (s.plan as string) ?? "",
    cycle: (s.cycle as "monthly" | "yearly" | undefined) ?? undefined,
  }),
  component: BillingPage,
});

// react-doctor-disable-next-line react-doctor/only-export-components
// react-doctor-disable-next-line react-doctor/prefer-useReducer
function BillingPage() {
  const { user } = useAuth();
  const { plan: currentPlan, credits, allPlans, reload, yearlyDiscountPercent } = usePlan();
  const { plan: planSearch, cycle: cycleSearch } = Route.useSearch();
  const navigate = useNavigate();
  const { isHost, hostInfo, loading: hostLoading } = useHost();

  const { accounts, history, creditTx, creditPacks } = useBillingData(user?.id);

  // react-doctor-disable-next-line react-doctor/no-event-handler
  const [selectedPlan, setSelectedPlan] = useState<PlanInfo | null>(null);

  useEffect(() => {
    if (planSearch && allPlans.length > 0) {
      const found = allPlans.find((p) => p.slug === planSearch);
      // react-doctor-disable-next-line react-doctor/no-chain-state-updates
      // react-doctor-disable-next-line react-doctor/no-derived-state
      if (found) {
        setSelectedPlan(found);
        setStep("pay");
      }
    }
  }, [planSearch, allPlans]);
  // react-doctor-disable-next-line react-doctor/no-event-handler
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  // react-doctor-disable-next-line react-doctor/no-event-handler
  const [step, setStep] = useState<BillingStep>(planSearch ? "pay" : "overview");
  // react-doctor-disable-next-line react-doctor/no-event-handler
  const [pickMode, setPickMode] = useState<PickMode>("pack");
  // react-doctor-disable-next-line react-doctor/no-event-handler
  const [txRef, setTxRef] = useState("");
  // react-doctor-disable-next-line react-doctor/no-event-handler
  const [notes, setNotes] = useState("");
  // react-doctor-disable-next-line react-doctor/no-event-handler
  const [screenshot, setScreenshot] = useState<File | null>(null);
  // react-doctor-disable-next-line react-doctor/no-event-handler
  const [uploading, setUploading] = useState(false);
  // react-doctor-disable-next-line react-doctor/no-event-handler
  const [copied, setCopied] = useState<string | null>(null);
  // react-doctor-disable-next-line react-doctor/no-event-handler
  const [appliedPromo, setAppliedPromo] = useState<PromoResult | null>(null);
  // react-doctor-disable-next-line react-doctor/no-event-handler
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(cycleSearch ?? "monthly");

  const isFreeUser = !currentPlan || currentPlan.slug === "individual_starter";
  const canBuyCredits = currentPlan?.can_buy_credits ?? false;
  const individualPlans = allPlans.filter((p) => p.tier === "individual" && p.price_pkr > 0);
  const enterprisePlans = allPlans.filter((p) => p.tier === "enterprise" && p.price_pkr > 0);

  // Free users with no active plan selection → send them to the plan picker in settings.
  // If they arrived with ?plan=... they're in the middle of upgrading - let them through.
  if (
    !hostLoading &&
    !isHost &&
    currentPlan &&
    FREE_SLUGS.includes(currentPlan.slug) &&
    !planSearch
  ) {
    void navigate({ to: "/settings", search: { tab: "plan" } });
    return null;
  }

  const copyToClipboard = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleBuyCreditPack = (pack: CreditPackage) => {
    const fakePlan = {
      ...currentPlan!,
      id: `__credit_pack__${pack.id}`,
      name: `${pack.credits} Credits, ${pack.name}`,
      price_pkr: pack.price_pkr,
      credits_per_month: pack.credits,
    } as PlanInfo;
    setSelectedPlan(fakePlan);
    setStep("pay");
  };

  const handleFreePromo = async (promo: PromoResult) => {
    if (!user || !selectedPlan) return;
    setUploading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("redeem_free_promo", {
      p_code: promo.code,
      p_plan_id: selectedPlan.id,
    });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("🎁 Plan activated for free!");
    setStep("done");
    void reload();
  };

  const handleUpload = async () => {
    if (!user || !screenshot || !selectedPlan || !selectedMethod) return;
    setUploading(true);
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
    if (!ALLOWED_TYPES.includes(screenshot.type)) {
      toast.error("Only JPG, PNG, or WebP screenshots are accepted.");
      setUploading(false);
      return;
    }
    const ext = screenshot.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `payment-screenshots/${user.id}/${Date.now()}.${ext}`;
    const { error: storErr } = await supabase.storage
      .from("uploads")
      .upload(path, screenshot, { contentType: screenshot.type });
    if (storErr) {
      toast.error("Upload failed: " + storErr.message);
      setUploading(false);
      return;
    }
    const isCreditPack = selectedPlan.id.startsWith("__credit_pack__");
    const basePrice = isCreditPack
      ? selectedPlan.price_pkr
      : cyclePrice(selectedPlan.price_pkr, billingCycle, yearlyDiscountPercent);
    const discountedPrice = appliedPromo
      ? appliedPromo.discount_type === "percent" && appliedPromo.discount_percent
        ? Math.max(0, Math.round(basePrice * (1 - appliedPromo.discount_percent / 100)))
        : appliedPromo.discount_type === "fixed" && appliedPromo.discount_fixed_pkr
          ? Math.max(0, basePrice - appliedPromo.discount_fixed_pkr)
          : basePrice
      : basePrice;

    const promoNote = appliedPromo ? `Promo: ${appliedPromo.code}` : null;
    const fullNotes = [notes.trim() || null, promoNote].filter(Boolean).join(" | ");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("manual_payments").insert({
      user_id: user.id,
      plan_id: isCreditPack ? null : selectedPlan.id,
      amount_pkr: discountedPrice,
      payment_method: selectedMethod as "easypaisa" | "jazzcash" | "bank_transfer" | "other",
      transaction_ref: txRef.trim() || null,
      screenshot_url: path,
      status: "pending" as "pending" | "approved" | "rejected" | "refunded",
      credits_to_add: 0,
      notes: fullNotes || null,
      billing_cycle: isCreditPack ? "monthly" : billingCycle,
    });
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Increment promo uses_count for non-free promos
    if (appliedPromo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc("record_promo_use", { p_code: appliedPromo.code });
    }
    toast.success("Payment submitted! Admin will verify within 24 hours.");
    setStep("done");
    void reload();
  };

  if (hostLoading) return null;
  if (isHost && hostInfo)
    return <HostBillingView hostMember={hostInfo} userId={user!.id} creditTx={creditTx} />;

  if (step === "overview")
    return (
      <OverviewStep
        credits={credits}
        currentPlan={currentPlan}
        isFreeUser={isFreeUser}
        canBuyCredits={canBuyCredits}
        history={history}
        creditTx={creditTx}
        onPickPack={() => {
          setPickMode("pack");
          setStep("pick");
        }}
        onPickPlan={() => {
          setPickMode("plan");
          setStep("pick");
        }}
      />
    );

  if (step === "pick")
    return (
      <PickStep
        pickMode={pickMode}
        canBuyCredits={canBuyCredits}
        creditPacks={creditPacks}
        individualPlans={individualPlans}
        enterprisePlans={enterprisePlans}
        currentPlanSlug={currentPlan?.slug}
        onSelectPack={handleBuyCreditPack}
        onSelectPlan={(p) => {
          setSelectedPlan(p);
          setStep("pay");
        }}
        onUpgradePlan={() => setPickMode("plan")}
        onBack={() => setStep("overview")}
        cycle={billingCycle}
        onCycleChange={setBillingCycle}
        yearlyDiscountPercent={yearlyDiscountPercent}
      />
    );

  if (step === "pay" && selectedPlan)
    return (
      <PayStep
        selectedPlan={selectedPlan}
        accounts={accounts}
        onSelectMethod={(method, promo) => {
          setSelectedMethod(method);
          setAppliedPromo(promo);
          setStep("upload");
        }}
        onFreePromo={(promo) => { setAppliedPromo(promo); void handleFreePromo(promo); }}
        onBack={() => {
          if (planSearch) {
            void navigate({ to: "/settings", search: { tab: "plan" } });
          } else {
            setStep("pick");
          }
        }}
        cycle={billingCycle}
        yearlyDiscountPercent={yearlyDiscountPercent}
      />
    );

  if (step === "upload" && selectedPlan && selectedMethod)
    return (
      <UploadStep
        selectedPlan={selectedPlan}
        displayPrice={
          selectedPlan.id.startsWith("__credit_pack__")
            ? selectedPlan.price_pkr
            : cyclePrice(selectedPlan.price_pkr, billingCycle, yearlyDiscountPercent)
        }
        cycle={billingCycle}
        selectedMethod={selectedMethod}
        accounts={accounts}
        txRef={txRef}
        notes={notes}
        screenshot={screenshot}
        uploading={uploading}
        copied={copied}
        onTxRefChange={setTxRef}
        onNotesChange={setNotes}
        onScreenshotChange={setScreenshot}
        onCopy={copyToClipboard}
        onSubmit={() => void handleUpload()}
        onBack={() => setStep("pay")}
      />
    );

  if (step === "done")
    return (
      <DoneStep
        onDashboard={() => void navigate({ to: "/dashboard" })}
        onReset={() => {
          setStep("overview");
          setScreenshot(null);
          setTxRef("");
          setNotes("");
          setAppliedPromo(null);
        }}
      />
    );

  return null;
}
