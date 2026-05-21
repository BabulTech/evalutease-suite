import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { validationError } from "@/components/ui/validation-toast";
import { AuthShell } from "./login";
import { Logo } from "@/components/Logo";
import { ensureSelectedPlan } from "@/lib/plan.server";
import { logClientActivity } from "@/lib/audit";
import { Check, User, Building2, ChevronRight, ChevronLeft, Eye, EyeOff, Loader2 } from "lucide-react";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

const USER_TYPES = [
  {
    slug: "individual_starter",
    label: "Personal",
    desc: "I'm an individual teacher, trainer, or student",
    icon: User,
    color: "text-primary",
    activeBorder: "border-primary/60 bg-primary/5 ring-2 ring-primary/40",
    inactiveBorder: "border-border bg-secondary/20 hover:border-primary/40",
    note: "Start free forever",
  },
  {
    slug: "enterprise_starter",
    label: "Enterprise",
    desc: "We're a school, company, or team",
    icon: Building2,
    color: "text-yellow-400",
    activeBorder: "border-yellow-400/60 bg-yellow-400/5 ring-2 ring-yellow-400/40",
    inactiveBorder: "border-border bg-secondary/20 hover:border-yellow-400/40",
    note: "15-day free trial included",
  },
] as const;

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(100)
  .refine(v => /[A-Z]/.test(v), "Must contain an uppercase letter")
  .refine(v => /[a-z]/.test(v), "Must contain a lowercase letter")
  .refine(v => /[0-9]/.test(v), "Must contain a number")
  .refine(v => /[^A-Za-z0-9]/.test(v), "Must contain a special character");

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Very weak", color: "bg-red-500" };
  if (score === 2) return { score, label: "Weak", color: "bg-orange-500" };
  if (score === 3) return { score, label: "Fair", color: "bg-yellow-500" };
  if (score === 4) return { score, label: "Good", color: "bg-blue-500" };
  return { score, label: "Strong", color: "bg-green-500" };
}

const PW_RULES = [
  { test: (v: string) => v.length >= 8,         label: "At least 8 characters" },
  { test: (v: string) => /[A-Z]/.test(v),       label: "One uppercase letter" },
  { test: (v: string) => /[a-z]/.test(v),       label: "One lowercase letter" },
  { test: (v: string) => /[0-9]/.test(v),       label: "One number" },
  { test: (v: string) => /[^A-Za-z0-9]/.test(v), label: "One special character (!@#$…)" },
];

const SIGNUP_STEPS = [
  "Creating your account…",
  "Setting up your workspace…",
  "Configuring your plan…",
  "Almost ready…",
];

const schema = z.object({
  firstName: z.string().trim().min(1, "First name required").max(60),
  lastName:  z.string().trim().min(1, "Last name required").max(60),
  mobile:    z.string().trim().max(30).optional(),
  email:     z.string().trim().email("Invalid email").max(255),
  password:  passwordSchema,
  role:      z.string().min(1, "Please select your role"),
  useCases:  z.array(z.string()).min(1, "Select at least one use case"),
  referral:  z.string().min(1, "Please select how you heard about us"),
  school:       z.string().trim().max(120).optional(),
  gradeYear:    z.string().trim().max(60).optional(),
  fieldOfStudy: z.string().trim().max(120).optional(),
  institution:  z.string().trim().max(120).optional(),
  subjectTaught:z.string().trim().max(120).optional(),
  yearsExp:     z.string().trim().max(10).optional(),
  companyName:  z.string().trim().max(120).optional(),
  industry:     z.string().trim().max(120).optional(),
  teamSize:     z.string().trim().max(20).optional(),
  otherDetails: z.string().trim().max(300).optional(),
});

const USE_CASES = ["Education", "Sports", "Fun", "Religion", "Science", "Academic"] as const;
const ROLES     = ["Student", "Teacher", "Employer", "Other"] as const;
const REFERRALS = ["Ads", "Friend Recommendation", "Employee Referral", "Web Search"] as const;
const REFERRAL_KEYS: Record<string, string> = {
  "Ads": "signup.referral.ads",
  "Friend Recommendation": "signup.referral.friend",
  "Employee Referral": "signup.referral.employee",
  "Web Search": "signup.referral.webSearch",
};
const INDUSTRIES = ["Education", "Technology", "Healthcare", "Finance", "Retail", "Government", "Non-profit", "Other"] as const;
const TEAM_SIZES = ["Just me", "2–10", "11–50", "51–200", "200+"] as const;
const GRADE_YEARS = ["Grade 1–5", "Grade 6–8", "Grade 9–10", "Grade 11–12", "Undergraduate", "Postgraduate", "PhD", "Other"] as const;

type FieldErrors = Partial<Record<string, string>>;

function ChipButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium border transition-all flex items-center gap-1.5 ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-glow"
          : "bg-secondary/40 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {active && <Check size={12} />}{children}
    </button>
  );
}

function RoleButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[48px] flex-1 rounded-xl border text-sm font-semibold transition-all px-3 py-2 ${
        active
          ? "bg-primary text-primary-foreground border-primary shadow-glow"
          : "bg-secondary/30 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-1">{msg}</p>;
}

function SignupPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPlan, setSelectedPlan] = useState<string>("individual_starter");
  const [form, setForm] = useState({
    firstName: "", lastName: "", mobile: "",
    email: "", password: "", role: "", useCases: [] as string[], referral: "",
    school: "", gradeYear: "", fieldOfStudy: "",
    institution: "", subjectTaught: "", yearsExp: "",
    companyName: "", industry: "", teamSize: "",
    otherDetails: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [emailCheckState, setEmailCheckState] = useState<"idle" | "checking" | "taken" | "available">("idle");
  const emailCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const firstNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  useEffect(() => {
    if (step === 2) firstNameRef.current?.focus();
  }, [step]);

  const set = (k: keyof Omit<typeof form, "useCases">) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm({ ...form, [k]: e.target.value });
      if (errors[k]) setErrors(prev => ({ ...prev, [k]: undefined }));
    };

  const checkEmailExists = useCallback((email: string) => {
    if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailCheckState("idle");
      return;
    }
    setEmailCheckState("checking");
    emailCheckTimer.current = setTimeout(async () => {
      const { data } = await supabase.rpc("check_email_exists", { p_email: trimmed });
      setEmailCheckState(data ? "taken" : "available");
    }, 600);
  }, []);

  const toggleUseCase = (val: string) =>
    setForm(f => ({
      ...f,
      useCases: f.useCases.includes(val)
        ? f.useCases.filter(u => u !== val)
        : [...f.useCases, val],
    }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (emailCheckState === "taken") { validationError("This email is already registered. Please sign in instead."); return; }
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fe: FieldErrors = {};
      parsed.error.issues.forEach(i => {
        const key = String(i.path[0]);
        if (!fe[key]) fe[key] = i.message;
      });
      setErrors(fe);
      // show first error as toast for accessibility
      validationError(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    setLoadingStep(0);
    const stepTimer = setInterval(() => setLoadingStep(s => Math.min(s + 1, SIGNUP_STEPS.length - 1)), 1200);
    window.localStorage.setItem("pending_signup_plan", selectedPlan);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          first_name:    parsed.data.firstName,
          last_name:     parsed.data.lastName,
          full_name:     `${parsed.data.firstName} ${parsed.data.lastName}`,
          mobile:        parsed.data.mobile,
          role:          parsed.data.role,
          use_cases:     parsed.data.useCases,
          referral:      parsed.data.referral,
          selected_plan: selectedPlan,
          school:        parsed.data.school,
          grade_year:    parsed.data.gradeYear,
          field_of_study:parsed.data.fieldOfStudy,
          institution:   parsed.data.institution,
          subject_taught:parsed.data.subjectTaught,
          years_exp:     parsed.data.yearsExp,
          company_name:  parsed.data.companyName,
          industry:      parsed.data.industry,
          team_size:     parsed.data.teamSize,
          other_details: parsed.data.otherDetails,
        },
      },
    });
    if (error) { clearInterval(stepTimer); setLoading(false); validationError(error.message); return; }

    void logClientActivity({
      actionType: "signed_up",
      module: "auth",
      entityType: "account",
      entityLabel: parsed.data.email,
      message: `New account: ${parsed.data.firstName} ${parsed.data.lastName}`,
      details: { plan: selectedPlan, role: parsed.data.role },
      riskScore: 10,
    });

    // Ensure correct plan is assigned (in case trigger missed it)
    try {
      // Wait briefly for session to be established
      await new Promise((r) => setTimeout(r, 500));
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await ensureSelectedPlan({
          data: {
            planSlug: selectedPlan === "enterprise_starter" ? "enterprise_starter" : "individual_starter",
            _token: session.access_token,
          },
        });
        window.localStorage.removeItem("pending_signup_plan");
      }
    } catch (e) {
      console.warn("Plan assignment fallback failed:", e);
    }

    // Send welcome email (fire-and-forget)
    try {
      const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;
      const name = parsed.data.fullName || parsed.data.email.split("@")[0];
      await supabase.functions.invoke("send-email", {
        body: { type: "welcome", data: { to: parsed.data.email, name, appUrl } },
      });
    } catch (e) { console.warn("Welcome email failed:", e); }

    clearInterval(stepTimer);
    setLoading(false);
    toast.success("Account created! Welcome.");
    navigate({ to: "/dashboard" });
  };

  const onGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) { setLoading(false); validationError("Google sign-in failed"); return; }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  const pwStrength = getPasswordStrength(form.password);

  return (
    <AuthShell>
      {/* Full-screen loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5 p-8 rounded-3xl border border-border bg-card/90 shadow-2xl min-w-[280px]">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
              <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-primary/50 animate-spin [animation-duration:0.7s] [animation-direction:reverse]" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">{SIGNUP_STEPS[loadingStep]}</p>
              <p className="text-xs text-muted-foreground mt-1">Please don't close this window</p>
            </div>
            <div className="flex gap-1.5">
              {SIGNUP_STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i <= loadingStep ? "w-6 bg-primary" : "w-1.5 bg-border"}`} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Logo */}
      <div className="flex justify-center mb-5">
        <Logo size="sm" />
      </div>

      {/* Tab switcher */}
      <div className="grid grid-cols-2 gap-1.5 mb-5 p-1 bg-secondary/50 rounded-2xl">
        <Link
          to="/login"
          className="rounded-xl py-3 text-sm font-semibold text-muted-foreground hover:text-foreground text-center transition-colors"
        >
          {t("auth.signin")}
        </Link>
        <button type="button" className="rounded-xl py-3 text-sm font-semibold bg-primary text-primary-foreground shadow-glow">
          {t("auth.signup")}
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step >= s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}>
              {step > s ? <Check size={14} /> : s}
            </div>
            {s < 2 && <div className={`h-px flex-1 w-10 transition-all ${step > 1 ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
        <span className="ml-2 text-xs text-muted-foreground">
          {step === 1 ? "Choose Plan" : "Your Profile"}
        </span>
      </div>

      {/* ── STEP 1: How will you use it? ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="-mt-2 mb-1">
            <p className="text-base font-semibold">How will you use EvaluTease?</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pick the one that fits you — you can always change later.</p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {USER_TYPES.map(type => {
              const Icon = type.icon;
              const active = selectedPlan === type.slug;
              return (
                <button
                  key={type.slug}
                  type="button"
                  onClick={() => setSelectedPlan(type.slug)}
                  className={`w-full text-left rounded-2xl border p-5 transition-all ${
                    active ? type.activeBorder : type.inactiveBorder
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl bg-secondary/60 shrink-0 ${type.color}`}>
                      <Icon size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-base">{type.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{type.desc}</div>
                      <div className={`text-xs font-semibold mt-1.5 ${type.color}`}>{type.note}</div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      active ? "border-primary bg-primary" : "border-border"
                    }`}>
                      {active && <Check size={12} className="text-primary-foreground" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            className="w-full h-12 bg-gradient-primary font-semibold shadow-glow text-base"
            onClick={() => setStep(2)}
          >
            Continue <ChevronRight size={16} className="ml-1" />
          </Button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-12 gap-3 bg-secondary/40 hover:bg-secondary text-base"
            onClick={onGoogle}
            disabled={loading}
          >
            <GoogleIcon />
            <span className="font-semibold">{t("auth.continueGoogle")}</span>
          </Button>

          <p className="text-center text-sm text-muted-foreground pt-1">
            {t("auth.haveAccount")}{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">{t("auth.signin")}</Link>
          </p>
        </div>
      )}

      {/* ── STEP 2: Profile form ── */}
      {step === 2 && (
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Name row — stacked on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName" className="mb-1.5 text-xs">{t("auth.firstName")}</Label>
              <Input
                id="firstName"
                ref={firstNameRef}
                value={form.firstName}
                onChange={set("firstName")}
                placeholder="Ali"
                className={`h-12 text-base ${errors.firstName ? "border-destructive" : ""}`}
                autoComplete="given-name"
                aria-invalid={!!errors.firstName}
                aria-describedby={errors.firstName ? "err-firstName" : undefined}
              />
              <FieldError msg={errors.firstName} />
            </div>
            <div>
              <Label htmlFor="lastName" className="mb-1.5 text-xs">{t("auth.lastName")}</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={set("lastName")}
                placeholder="Khan"
                className={`h-12 text-base ${errors.lastName ? "border-destructive" : ""}`}
                autoComplete="family-name"
                aria-invalid={!!errors.lastName}
              />
              <FieldError msg={errors.lastName} />
            </div>
          </div>

          {/* Role — button grid (Fitts' Law, no dropdown scan) */}
          <div>
            <Label className="mb-2 text-xs block">{t("signup.iAm")}</Label>
            <div className="flex gap-2 flex-wrap">
              {ROLES.map(r => (
                <RoleButton
                  key={r}
                  active={form.role === r}
                  onClick={() => {
                    setForm(f => ({ ...f, role: r }));
                    if (errors.role) setErrors(prev => ({ ...prev, role: undefined }));
                  }}
                >
                  {t(`signup.role.${r.toLowerCase()}`)}
                </RoleButton>
              ))}
            </div>
            <FieldError msg={errors.role} />
          </div>

          {/* Mobile */}
          <div>
            <Label htmlFor="mobile" className="mb-1.5 text-xs">{t("auth.mobile")} <span className="text-muted-foreground">(optional)</span></Label>
            <Input
              id="mobile"
              value={form.mobile}
              onChange={set("mobile")}
              type="tel"
              inputMode="tel"
              placeholder="+92 300 0000000"
              className="h-12 text-base"
              autoComplete="tel"
            />
          </div>

          {/* Role-specific fields */}
          {form.role === "Student" && (
            <div className="space-y-3 p-4 rounded-2xl bg-primary/5 border border-primary/15">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">{t("signup.student.details")}</p>
              <div>
                <Label className="mb-1.5 text-xs">School / University</Label>
                <Input value={form.school} onChange={set("school")} placeholder="University of Karachi" className="h-12 text-base" autoComplete="organization" />
              </div>
              <div>
                <Label className="mb-2 text-xs block">Grade / Year</Label>
                <div className="flex flex-wrap gap-2">
                  {GRADE_YEARS.map(g => (
                    <ChipButton
                      key={g}
                      active={form.gradeYear === g}
                      onClick={() => setForm(f => ({ ...f, gradeYear: g }))}
                    >
                      {g}
                    </ChipButton>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-1.5 text-xs">Field of Study</Label>
                <Input value={form.fieldOfStudy} onChange={set("fieldOfStudy")} placeholder="e.g. Computer Science" className="h-12 text-base" />
              </div>
            </div>
          )}

          {form.role === "Teacher" && (
            <div className="space-y-3 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/15">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">{t("signup.teacher.details")}</p>
              <div>
                <Label className="mb-1.5 text-xs">Institution / School Name</Label>
                <Input value={form.institution} onChange={set("institution")} placeholder="Beaconhouse School" className="h-12 text-base" autoComplete="organization" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 text-xs">Subject Taught</Label>
                  <Input value={form.subjectTaught} onChange={set("subjectTaught")} placeholder="Mathematics" className="h-12 text-base" />
                </div>
                <div>
                  <Label className="mb-1.5 text-xs">Years of Experience</Label>
                  <Input value={form.yearsExp} onChange={set("yearsExp")} type="number" inputMode="numeric" min="0" max="50" placeholder="5" className="h-12 text-base" />
                </div>
              </div>
            </div>
          )}

          {form.role === "Employer" && (
            <div className="space-y-3 p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/15">
              <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">{t("signup.employer.details")}</p>
              <div>
                <Label className="mb-1.5 text-xs">Company Name</Label>
                <Input value={form.companyName} onChange={set("companyName")} placeholder="Acme Corp" className="h-12 text-base" autoComplete="organization" />
              </div>
              <div>
                <Label className="mb-2 text-xs block">Industry</Label>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map(ind => (
                    <ChipButton
                      key={ind}
                      active={form.industry === ind}
                      onClick={() => setForm(f => ({ ...f, industry: ind }))}
                    >
                      {ind}
                    </ChipButton>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-2 text-xs block">Team Size</Label>
                <div className="flex flex-wrap gap-2">
                  {TEAM_SIZES.map(sz => (
                    <ChipButton
                      key={sz}
                      active={form.teamSize === sz}
                      onClick={() => setForm(f => ({ ...f, teamSize: sz }))}
                    >
                      {sz}
                    </ChipButton>
                  ))}
                </div>
              </div>
            </div>
          )}

          {form.role === "Other" && (
            <div className="space-y-2 p-4 rounded-2xl bg-purple-500/5 border border-purple-500/15">
              <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide">{t("signup.other.details")}</p>
              <textarea
                value={form.otherDetails}
                onChange={set("otherDetails")}
                rows={3}
                placeholder="Describe how you plan to use EvaluTease..."
                className="w-full rounded-xl border border-input bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <Label htmlFor="email" className="mb-1.5 text-xs">{t("auth.email")}</Label>
            <div className="relative">
              <Input
                id="email"
                value={form.email}
                onChange={(e) => { set("email")(e); checkEmailExists(e.target.value); }}
                type="email"
                inputMode="email"
                placeholder="you@example.com"
                className={`h-12 text-base pr-10 ${errors.email || emailCheckState === "taken" ? "border-destructive" : emailCheckState === "available" ? "border-green-500" : ""}`}
                autoComplete="email"
                aria-invalid={!!errors.email || emailCheckState === "taken"}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                {emailCheckState === "checking" && <Loader2 size={15} className="animate-spin text-muted-foreground" />}
                {emailCheckState === "available" && <Check size={15} className="text-green-500" />}
                {emailCheckState === "taken" && <span className="text-destructive text-lg font-bold">✕</span>}
              </div>
            </div>
            {emailCheckState === "taken" && (
              <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                An account with this email already exists. <Link to="/login" className="underline font-semibold">Sign in instead?</Link>
              </p>
            )}
            {emailCheckState === "available" && (
              <p className="mt-1 text-xs text-green-500">Email is available ✓</p>
            )}
            <FieldError msg={errors.email} />
          </div>

          {/* Password with show/hide + strength meter */}
          <div>
            <Label htmlFor="password" className="mb-1.5 text-xs">{t("auth.password")}</Label>
            <div className="relative">
              <Input
                id="password"
                value={form.password}
                onChange={set("password")}
                onFocus={() => setPwFocused(true)}
                onBlur={() => setPwFocused(false)}
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 characters"
                className={`h-12 text-base pr-12 ${errors.password ? "border-destructive" : ""}`}
                autoComplete="new-password"
                aria-invalid={!!errors.password}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-0 top-0 h-12 w-12 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {/* Strength bar */}
            {form.password.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1 mb-1">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= pwStrength.score ? pwStrength.color : "bg-border"}`} />
                  ))}
                </div>
                <p className={`text-xs font-medium ${pwStrength.score <= 2 ? "text-red-400" : pwStrength.score === 3 ? "text-yellow-400" : pwStrength.score === 4 ? "text-blue-400" : "text-green-400"}`}>
                  {pwStrength.label}
                </p>
              </div>
            )}
            {/* Rules checklist — shown while focused or on error */}
            {(pwFocused || errors.password) && form.password.length > 0 && (
              <ul className="mt-2 space-y-1">
                {PW_RULES.map(rule => {
                  const passed = rule.test(form.password);
                  return (
                    <li key={rule.label} className={`flex items-center gap-1.5 text-xs transition-colors ${passed ? "text-green-400" : "text-muted-foreground"}`}>
                      <Check size={10} className={passed ? "opacity-100" : "opacity-0"} />
                      <span className={passed ? "" : "pl-3.5"}>{rule.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            <FieldError msg={errors.password} />
          </div>

          {/* Use cases — chips (Fitts' Law 44px) */}
          <div>
            <Label className="mb-2 text-xs block">{t("signup.useFor")}</Label>
            <div className="flex flex-wrap gap-2">
              {USE_CASES.map(uc => (
                <ChipButton
                  key={uc}
                  active={form.useCases.includes(uc)}
                  onClick={() => toggleUseCase(uc)}
                >
                  {t(`signup.useCase.${uc.toLowerCase()}`)}
                </ChipButton>
              ))}
            </div>
            <FieldError msg={errors.useCases} />
          </div>

          {/* Referral — chips (no dropdown scan) */}
          <div>
            <Label className="mb-2 text-xs block">{t("signup.hearAbout")}</Label>
            <div className="flex flex-wrap gap-2">
              {REFERRALS.map(r => (
                <ChipButton
                  key={r}
                  active={form.referral === r}
                  onClick={() => {
                    setForm(f => ({ ...f, referral: r }));
                    if (errors.referral) setErrors(prev => ({ ...prev, referral: undefined }));
                  }}
                >
                  {t(REFERRAL_KEYS[r] ?? r)}
                </ChipButton>
              ))}
            </div>
            <FieldError msg={errors.referral} />
          </div>

          {/* Selected type badge */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <span className="text-xs text-muted-foreground">Account type:</span>
            <span className="text-xs font-bold text-primary">
              {USER_TYPES.find(p => p.slug === selectedPlan)?.label}
            </span>
            <button type="button" onClick={() => setStep(1)} className="ml-auto text-xs text-primary hover:underline min-h-[32px] px-2">
              Change
            </button>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="h-12 w-12 shrink-0 p-0"
              onClick={() => setStep(1)}
              aria-label="Go back"
            >
              <ChevronLeft size={18} />
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 h-12 bg-gradient-primary font-semibold shadow-glow hover:opacity-90 text-base"
            >
              {t("signup.createAccount")}
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground pb-2">
            {t("auth.haveAccount")}{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">{t("auth.signin")}</Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.63z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.32z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96L3.97 7.28C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  );
}
