import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { validationError } from "@/components/ui/validation-toast";
import { AuthShell } from "./login";
import { ensureSelectedPlan } from "@/lib/plan.server";
import { logClientActivity } from "@/lib/audit";

import { SIGNUP_STEPS } from "./signup/constants";
import { signupSchema, initialForm, type FieldErrors } from "./signup/-schema";
import { LoadingOverlay } from "./signup/LoadingOverlay";
import { StepIndicator } from "./signup/StepIndicator";
import { PlanSelector } from "./signup/PlanSelector";
import { ProfileForm } from "./signup/ProfileForm";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/signup")({ component: SignupPage });

// react-doctor-disable-next-line react-doctor/prefer-useReducer
// react-doctor-disable-next-line react-doctor/only-export-components
function SignupPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPlan, setSelectedPlan] = useState("individual_starter");
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
    if (step === 2) firstNameRef.current?.focus();
  }, [step]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailCheckStateRef.current === "taken") {
      validationError("This email is already registered. Please sign in instead.");
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
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          first_name: parsed.data.firstName,
          last_name: parsed.data.lastName,
          full_name: `${parsed.data.firstName} ${parsed.data.lastName}`,
          mobile: parsed.data.mobile,
          role: parsed.data.role,
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
              selectedPlan === "enterprise_starter" ? "enterprise_starter" : "individual_starter",
            _token: session.access_token,
          },
        });
        window.localStorage.removeItem("pending_signup_plan");
      }
    } catch (e) {
      console.warn("Plan assignment fallback failed:", e);
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

  const onGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/dashboard" },
    });
    if (error) {
      setLoading(false);
      validationError("Google sign-in failed");
    }
  };

  return (
    <AuthShell>
      {loading && <LoadingOverlay loadingStep={loadingStep} />}

      <div className="flex justify-center mb-5">
        <Logo size="sm" />
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

      <StepIndicator step={step} />

      {step === 1 && (
        <PlanSelector
          selectedPlan={selectedPlan}
          onSelect={(p) => setSelectedPlan(p)}
          onContinue={() => setStep(2)}
          onGoogle={onGoogle}
          loading={loading}
        />
      )}

      {step === 2 && (
        <ProfileForm
          form={form}
          setForm={setForm}
          errors={errors}
          setErrors={setErrors}
          selectedPlan={selectedPlan}
          loading={loading}
          firstNameRef={firstNameRef}
          onSubmit={onSubmit}
          onBack={() => setStep(1)}
          onChangePlan={() => setStep(1)}
          onEmailCheckChange={(state) => {
            emailCheckStateRef.current = state;
          }}
        />
      )}
    </AuthShell>
  );
}
