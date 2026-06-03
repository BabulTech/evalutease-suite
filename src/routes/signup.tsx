import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { validationError } from "@/components/ui/validation-toast";
import { AuthShell } from "./login";
import { ensureSelectedPlan } from "@/lib/plan.server";
import { logClientActivity } from "@/lib/audit";

import { SIGNUP_STEPS, isFreeEmailDomain, requiresWorkEmail } from "./signup/constants";
import { signupSchema, initialForm, type FieldErrors } from "./signup/-schema";
import { LoadingOverlay } from "./signup/LoadingOverlay";
import { StepIndicator } from "./signup/StepIndicator";
import { PlanSelector } from "./signup/PlanSelector";
import { TierSelector } from "./signup/TierSelector";
import { PaymentUpload, type PaymentMethodId } from "./signup/PaymentUpload";
import { ProfileStep1 } from "./signup/ProfileStep1";
import { ProfileStep2 } from "./signup/ProfileStep2";
import { ProfileStep3 } from "./signup/ProfileStep3";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/signup")({ component: SignupPage });

// react-doctor-disable-next-line react-doctor/prefer-useReducer
// react-doctor-disable-next-line react-doctor/only-export-components
function SignupPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [category, setCategory] = useState("personal");
  // Default to the paid (Pro) tier so the popular plan is pre-selected.
  const [selectedPlan, setSelectedPlan] = useState("individual_pro");
  const [isNgo, setIsNgo] = useState(false);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [ngoFile, setNgoFile] = useState<File | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId | null>(null);
  // Default to annual billing (better value) for both Personal and Enterprise.
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const emailCheckStateRef = useRef<"idle" | "checking" | "taken" | "available">("idle");
  const firstNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  useEffect(() => {
    if (step === 4) firstNameRef.current?.focus();
  }, [step]);

  const isPaid = selectedPlan === "individual_pro" || selectedPlan === "enterprise_pro";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailCheckStateRef.current === "taken") {
      validationError("This email is already registered. Please sign in instead.");
      return;
    }
    if (requiresWorkEmail(category, form.enterpriseType) && isFreeEmailDomain(form.email)) {
      setErrors((p) => ({ ...p, email: "Company accounts must use a work email." }));
      validationError("Please use your work email — personal providers like Gmail aren't allowed for company accounts.");
      setStep(4);
      return;
    }
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      const fe: FieldErrors = {};
      parsed.error.issues.forEach((i) => {
        const key = String(i.path[0]);
        if (!fe[key]) fe[key] = i.message;
      });
      setErrors(fe);
      validationError(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    setLoadingStep(0);
    const stepTimer = setInterval(
      () => setLoadingStep((s) => Math.min(s + 1, SIGNUP_STEPS.length - 1)),
      1200,
    );
    window.localStorage.setItem("pending_signup_plan", selectedPlan);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
          full_name: `${parsed.data.firstName} ${parsed.data.lastName}`,
          mobile: parsed.data.mobile,
          // Sent as profile_role (not "role") so it can never be confused
          // with an authorization claim. Authz is resolved server-side from
          // public.user_roles, never from JWT metadata. A DB trigger also
          // strips any privilege-shaped keys from metadata as defense in depth.
          profile_role: parsed.data.role,
          use_cases: parsed.data.useCases,
          referral: parsed.data.referral,
          selected_plan: selectedPlan,
          school: parsed.data.school,
          grade_year: parsed.data.gradeYear,
          field_of_study: parsed.data.fieldOfStudy,
          institution: parsed.data.institution,
          subject_taught: parsed.data.subjectTaught,
          years_exp: parsed.data.yearsExp,
          company_name: parsed.data.companyName,
          industry: parsed.data.industry,
          team_size: parsed.data.teamSize,
          other_details: parsed.data.otherDetails,
          department: parsed.data.department,
          enterprise_type: parsed.data.enterpriseType,
        },
      },
    });
    if (error) {
      clearInterval(stepTimer);
      setLoading(false);
      validationError(error.message);
      return;
    }

    void logClientActivity({
      actionType: "signed_up",
      module: "auth",
      entityType: "account",
      entityLabel: parsed.data.email,
      message: `New account: ${parsed.data.firstName} ${parsed.data.lastName}`,
      details: { plan: selectedPlan, role: parsed.data.role },
      riskScore: 10,
    });

    try {
      await new Promise((r) => setTimeout(r, 500));
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await ensureSelectedPlan({
          data: {
            planSlug:
              selectedPlan === "enterprise_free" ? "enterprise_free" : "individual_starter",
            _token: session.access_token,
            isNgo,
          },
        });
        window.localStorage.removeItem("pending_signup_plan");
      }
    } catch (e) {
      console.warn("Plan assignment fallback failed:", e);
    }

    // Upload payment screenshot (+ NGO certificate if applicable) for paid plans
    if (paymentFile) {
      const uid = signUpData?.user?.id ?? (await supabase.auth.getSession()).data.session?.user?.id;
      if (!uid) {
        validationError("Could not resolve user id for payment upload.");
      } else {
        const payExt = paymentFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const payPath = `payment-screenshots/${uid}/${Date.now()}.${payExt}`;
        const { error: payErr } = await supabase.storage
          .from("uploads")
          .upload(payPath, paymentFile, { contentType: paymentFile.type, upsert: false });
        if (payErr) {
          console.error("[signup] payment screenshot upload failed:", payErr);
          validationError("Screenshot upload failed: " + payErr.message);
        } else {
          // Upload NGO certificate if NGO plan selected
          let ngoPath: string | null = null;
          if (isNgo && ngoFile) {
            const ngoExt = ngoFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
            ngoPath = `payment-screenshots/${uid}/ngo-${Date.now()}.${ngoExt}`;
            const { error: ngoErr } = await supabase.storage
              .from("uploads")
              .upload(ngoPath, ngoFile, { contentType: ngoFile.type, upsert: false });
            if (ngoErr) {
              console.error("[signup] NGO certificate upload failed:", ngoErr);
              validationError("NGO certificate upload failed: " + ngoErr.message);
              ngoPath = null;
            }
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: rpcErr } = await (supabase as any).rpc("submit_payment_on_signup", {
            p_user_id:         uid,
            p_plan_slug:       selectedPlan,
            p_method:          paymentMethod ?? "other",
            p_screenshot:      payPath,
            p_notes:           `Signup: ${selectedPlan} · ${billingCycle}${isNgo ? " (NGO - 50% discount claim)" : ""}`,
            p_ngo_certificate: ngoPath,
            p_is_ngo:          isNgo,
            p_billing_cycle:   billingCycle,
          });
          if (rpcErr) {
            console.error("[signup] submit_payment_on_signup RPC failed:", rpcErr);
            validationError("Payment record failed: " + rpcErr.message);
          }
        }
      }
    }

    try {
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const name = parsed.data.firstName || parsed.data.email.split("@")[0];
      await supabase.functions.invoke("send-email", {
        body: { type: "welcome", data: { to: parsed.data.email, name, appUrl } },
      });
    } catch (e) {
      console.warn("Welcome email failed:", e);
    }

    clearInterval(stepTimer);
    setLoading(false);
    toast.success("Account created! Welcome.");
    navigate({ to: "/dashboard" });
  };


  return (
    <AuthShell>
      {loading && <LoadingOverlay loadingStep={loadingStep} />}

      <div className="flex flex-col items-center mb-5">
        <img src="/jancho_logo_512.svg" alt="Jancho" className="size-28 object-contain" />
        <p className="text-sm text-muted-foreground text-center mt-2">
          AI-Powered Platform to Evaluate Your Knowledge &amp; Skills
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1.5 mb-5 p-1 bg-secondary/50 rounded-2xl">
        <Link
          to="/login"
          className="rounded-xl py-3 text-sm font-semibold text-muted-foreground hover:text-foreground text-center transition-colors"
        >
          {t("auth.signin")}
        </Link>
        <button
          type="button"
          className="rounded-xl py-3 text-sm font-semibold bg-primary text-primary-foreground shadow-glow"
        >
          {t("auth.signup")}
        </button>
      </div>

      <StepIndicator step={step} totalSteps={6} />

      {step === 1 && (
        <PlanSelector
          selectedCategory={category}
          onSelect={(c) => {
            setCategory(c);
            // Pre-select the paid (Pro) tier for whichever category is chosen.
            setSelectedPlan(c === "enterprise" ? "enterprise_pro" : "individual_pro");
          }}
          onContinue={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <TierSelector
          category={category}
          selectedTier={selectedPlan}
          isNgo={isNgo}
          cycle={billingCycle}
          onSelect={setSelectedPlan}
          onNgoChange={setIsNgo}
          onCycleChange={setBillingCycle}
          onBack={() => setStep(1)}
          onContinue={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <ProfileStep1
          form={form}
          setForm={setForm}
          errors={errors}
          setErrors={setErrors}
          firstNameRef={firstNameRef}
          category={category}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <ProfileStep2
          form={form}
          setForm={setForm}
          errors={errors}
          setErrors={setErrors}
          category={category}
          onBack={() => setStep(3)}
          onNext={() => setStep(5)}
          onEmailCheckChange={(state) => { emailCheckStateRef.current = state; }}
          emailCheckStateRef={emailCheckStateRef}
        />
      )}

      {step === 5 && (
        <ProfileStep3
          form={form}
          setForm={setForm}
          errors={errors}
          setErrors={setErrors}
          selectedPlan={selectedPlan}
          loading={loading}
          isPaid={isPaid || isNgo}
          onSubmit={isPaid || isNgo ? (e) => { e.preventDefault(); setStep(6); } : onSubmit}
          onBack={() => setStep(4)}
          onChangePlan={() => setStep(1)}
        />
      )}

      {step === 6 && (isPaid || isNgo) && (
        <PaymentUpload
          isNgo={isNgo}
          paymentFile={paymentFile}
          ngoFile={ngoFile}
          paymentMethod={paymentMethod}
          onPaymentFile={setPaymentFile}
          onNgoFile={setNgoFile}
          onPaymentMethod={setPaymentMethod}
          onBack={() => setStep(5)}
          onContinue={() => { void onSubmit(new Event("submit") as unknown as React.FormEvent); }}
        />
      )}
    </AuthShell>
  );
}
