import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { AuthShell } from "./login";
import { Logo } from "@/components/Logo";
import { Check, Zap, Star, Building2, ChevronRight, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

// ── Plans ──────────────────────────────────────────────────────────────────────
const PLANS = [
  {
    slug: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    icon: Zap,
    color: "text-muted-foreground",
    border: "border-border hover:border-primary/40",
    badge: null,
    features: ["5 quizzes / day", "30 participants / session", "100 questions", "Basic analytics"],
  },
  {
    slug: "pro",
    name: "Pro",
    price: "$9",
    period: "/ month",
    icon: Star,
    color: "text-primary",
    border: "border-primary/60 shadow-[0_0_20px_rgba(34,197,94,0.15)]",
    badge: "Most Popular",
    features: ["Unlimited quizzes", "500 participants / session", "Unlimited questions", "Advanced analytics", "AI question generator", "Custom branding"],
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    price: "$29",
    period: "/ month",
    icon: Building2,
    color: "text-yellow-400",
    border: "border-yellow-400/40 hover:border-yellow-400/70",
    badge: null,
    features: ["Everything in Pro", "5,000 participants / session", "Dedicated support", "SSO / SAML", "API access", "Custom integrations"],
  },
] as const;

// ── Form schema ────────────────────────────────────────────────────────────────
const schema = z.object({
  firstName: z.string().trim().min(1, "First name required").max(60),
  lastName:  z.string().trim().min(1, "Last name required").max(60),
  mobile:    z.string().trim().max(30).optional(),
  email:     z.string().trim().email("Invalid email").max(255),
  password:  z.string().min(6, "Password must be at least 6 characters").max(100),
  role:      z.string().min(1, "Please select your role"),
  useCases:  z.array(z.string()).min(1, "Select at least one use case"),
  referral:  z.string().min(1, "Please select how you heard about us"),
  // role-specific
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

function SignupPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPlan, setSelectedPlan] = useState<string>("pro");
  const [form, setForm] = useState({
    firstName: "", lastName: "", mobile: "",
    email: "", password: "", role: "", useCases: [] as string[], referral: "",
    school: "", gradeYear: "", fieldOfStudy: "",
    institution: "", subjectTaught: "", yearsExp: "",
    companyName: "", industry: "", teamSize: "",
    otherDetails: "",
  });
  const [loading, setLoading] = useState(false);

  const set = (k: keyof Omit<typeof form, "useCases">) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [k]: e.target.value });

  const toggleUseCase = (val: string) =>
    setForm(f => ({
      ...f,
      useCases: f.useCases.includes(val)
        ? f.useCases.filter(u => u !== val)
        : [...f.useCases, val],
    }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
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
          // role-specific
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
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account created! Welcome.");
    navigate({ to: "/dashboard" });
  };

  const onGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) { setLoading(false); toast.error("Google sign-in failed"); return; }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  return (
    <AuthShell>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="font-display text-3xl font-bold">{t("auth.signup")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {step === 1 ? t("signup.choosePlan") : t("signup.completeProfile")}
          </p>
        </div>
        <Logo size="sm" />
      </div>

      {/* Login / Signup tabs */}
      <div className="grid grid-cols-2 gap-2 mb-5 p-1 bg-secondary/50 rounded-xl">
        <Link to="/login" className="rounded-lg py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground text-center">
          {t("auth.signin")}
        </Link>
        <button className="rounded-lg py-2.5 text-sm font-semibold bg-primary text-primary-foreground shadow-glow">
          {t("auth.signup")}
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2].map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step >= s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}>
              {step > s ? <Check size={13} /> : s}
            </div>
            {s < 2 && <div className={`h-px flex-1 w-8 transition-all ${step > 1 ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
        <span className="ml-2 text-xs text-muted-foreground">Step {step} of 2</span>
      </div>

      {/* ── STEP 1: Plan selection ── */}
      {step === 1 && (
        <div className="space-y-3">
          {PLANS.map(plan => {
            const Icon = plan.icon;
            const active = selectedPlan === plan.slug;
            return (
              <button
                key={plan.slug}
                type="button"
                onClick={() => setSelectedPlan(plan.slug)}
                className={`w-full text-left rounded-2xl border p-4 transition-all relative ${plan.border} ${
                  active ? "bg-primary/5 ring-2 ring-primary/40" : "bg-secondary/20 hover:bg-secondary/40"
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-2.5 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                    {plan.badge}
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-secondary/60 ${plan.color}`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{plan.name}</span>
                        <span className={`font-bold text-base ${plan.color}`}>{plan.price}</span>
                        <span className="text-xs text-muted-foreground">{plan.period}</span>
                      </div>
                      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        {plan.features.slice(0, 3).map(f => (
                          <li key={f} className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Check size={10} className="text-primary/70" />{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ml-2 transition-all ${
                    active ? "border-primary bg-primary" : "border-border"
                  }`}>
                    {active && <Check size={10} className="text-primary-foreground" />}
                  </div>
                </div>
              </button>
            );
          })}

          <Button
            type="button"
            className="w-full h-11 bg-gradient-primary font-semibold shadow-glow mt-2"
            onClick={() => setStep(2)}
          >
            Continue with {PLANS.find(p => p.slug === selectedPlan)?.name}
            <ChevronRight size={16} className="ml-1" />
          </Button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button type="button" variant="outline" className="w-full h-11 gap-3 bg-secondary/40 hover:bg-secondary" onClick={onGoogle} disabled={loading}>
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
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 text-xs">{t("auth.firstName")}</Label>
              <Input value={form.firstName} onChange={set("firstName")} placeholder="Ali" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="mb-1.5 text-xs">{t("auth.lastName")}</Label>
              <Input value={form.lastName} onChange={set("lastName")} placeholder="Khan" className="h-9 text-sm" />
            </div>
          </div>

          {/* Role dropdown */}
          <div>
            <Label className="mb-1.5 text-xs">{t("signup.iAm")}</Label>
            <select
              value={form.role}
              onChange={set("role")}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="" disabled>{t("signup.selectRole")}</option>
              {ROLES.map(r => <option key={r} value={r}>{t(`signup.role.${r.toLowerCase()}`)}</option>)}
            </select>
          </div>

          <div>
            <Label className="mb-1.5 text-xs">{t("auth.mobile")}</Label>
            <Input value={form.mobile} onChange={set("mobile")} type="tel" placeholder="+92 300..." className="h-9 text-sm" />
          </div>

          {/* ── Role-specific fields ── */}
          {form.role === "Student" && (
            <div className="space-y-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">{t("signup.student.details")}</p>
              <div>
                <Label className="mb-1.5 text-xs">School / University</Label>
                <Input value={form.school} onChange={set("school")} placeholder="e.g. University of Karachi" className="h-9 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 text-xs">Grade / Year</Label>
                  <select value={form.gradeYear} onChange={set("gradeYear")} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="" disabled>Select</option>
                    {GRADE_YEARS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="mb-1.5 text-xs">Field of Study</Label>
                  <Input value={form.fieldOfStudy} onChange={set("fieldOfStudy")} placeholder="e.g. Computer Science" className="h-9 text-sm" />
                </div>
              </div>
            </div>
          )}

          {form.role === "Teacher" && (
            <div className="space-y-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">{t("signup.teacher.details")}</p>
              <div>
                <Label className="mb-1.5 text-xs">Institution / School Name</Label>
                <Input value={form.institution} onChange={set("institution")} placeholder="e.g. Beaconhouse School" className="h-9 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 text-xs">Subject Taught</Label>
                  <Input value={form.subjectTaught} onChange={set("subjectTaught")} placeholder="e.g. Mathematics" className="h-9 text-sm" />
                </div>
                <div>
                  <Label className="mb-1.5 text-xs">Years of Experience</Label>
                  <Input value={form.yearsExp} onChange={set("yearsExp")} type="number" min="0" max="50" placeholder="e.g. 5" className="h-9 text-sm" />
                </div>
              </div>
            </div>
          )}

          {form.role === "Employer" && (
            <div className="space-y-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/15">
              <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">{t("signup.employer.details")}</p>
              <div>
                <Label className="mb-1.5 text-xs">Company Name</Label>
                <Input value={form.companyName} onChange={set("companyName")} placeholder="e.g. Acme Corp" className="h-9 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 text-xs">Industry</Label>
                  <select value={form.industry} onChange={set("industry")} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="" disabled>Select</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="mb-1.5 text-xs">Team Size</Label>
                  <select value={form.teamSize} onChange={set("teamSize")} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                    <option value="" disabled>Select</option>
                    {TEAM_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {form.role === "Other" && (
            <div className="space-y-2 p-3 rounded-xl bg-purple-500/5 border border-purple-500/15">
              <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide">{t("signup.other.details")}</p>
              <textarea
                value={form.otherDetails}
                onChange={set("otherDetails")}
                rows={3}
                placeholder="Describe how you plan to use EvaluTease..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>
          )}

          <div>
            <Label className="mb-1.5 text-xs">{t("auth.email")}</Label>
            <Input value={form.email} onChange={set("email")} type="email" placeholder="you@example.com" className="h-9 text-sm" />
          </div>

          <div>
            <Label className="mb-1.5 text-xs">{t("auth.password")}</Label>
            <Input value={form.password} onChange={set("password")} type="password" placeholder="••••••••" className="h-9 text-sm" />
          </div>

          {/* Use cases multi-select */}
          <div>
            <Label className="mb-2 text-xs block">{t("signup.useFor")}</Label>
            <div className="flex flex-wrap gap-2">
              {USE_CASES.map(uc => {
                const active = form.useCases.includes(uc);
                const label = t(`signup.useCase.${uc.toLowerCase()}`);
                return (
                  <button
                    key={uc}
                    type="button"
                    onClick={() => toggleUseCase(uc)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-glow"
                        : "bg-secondary/40 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {active && <Check size={10} className="inline mr-1" />}{label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Referral dropdown */}
          <div>
            <Label className="mb-1.5 text-xs">{t("signup.hearAbout")}</Label>
            <select
              value={form.referral}
              onChange={set("referral")}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="" disabled>Select an option</option>
              {REFERRALS.map(r => <option key={r} value={r}>{t(REFERRAL_KEYS[r] ?? r)}</option>)}
            </select>
          </div>

          {/* Selected plan badge */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/20">
            <span className="text-xs text-muted-foreground">{t("signup.selectedPlan")}:</span>
            <span className="text-xs font-bold text-primary">
              {PLANS.find(p => p.slug === selectedPlan)?.name} - {PLANS.find(p => p.slug === selectedPlan)?.price}
            </span>
            <button type="button" onClick={() => setStep(1)} className="ml-auto text-xs text-primary hover:underline">Change</button>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="h-11 px-4" onClick={() => setStep(1)}>
              <ChevronLeft size={16} />
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 h-11 bg-gradient-primary font-semibold shadow-glow hover:opacity-90">
              {loading ? t("common.loading") : t("signup.createAccount")}
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
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
