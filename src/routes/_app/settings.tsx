import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Settings as SettingsIcon,
  Trophy,
  ListChecks,
  User,
  Upload,
  MessageSquare,
  CreditCard,
  Check,
  Lock,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { optimizeAvatar, optimizeLogo } from "@/lib/image-optimization";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { usePlan } from "@/contexts/PlanContext";
import { LazyUpgradeModal } from "@/components/LazyUpgradeModal";
import {
  defaultHostSettings,
  normalizeRegistrationFields,
  REGISTRATION_FIELD_KEYS,
  REGISTRATION_FIELD_LABELS,
  type HostSettings,
  type RegistrationFieldKey,
} from "@/components/settings/host-settings";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

// Default customizable messages
const DEFAULT_MESSAGES = {
  lobby_title: "Welcome to the Quiz Lobby!",
  lobby_subtitle: "Please wait while the host starts the quiz.",
  lobby_waiting: "You're all set. The quiz will begin shortly.",
  completion_title: "Quiz Completed!",
  completion_subtitle: "Thanks for participating. The host will announce the final results.",
  registration_welcome: "Enter your details to join the quiz.",
};

type AppMessages = typeof DEFAULT_MESSAGES;

const MESSAGE_FIELD_KEYS: { key: keyof AppMessages; labelKey: string; descKey: string; multiline?: boolean }[] = [
  { key: "lobby_title",          labelKey: "settings.msgLobbyTitle",          descKey: "settings.msgLobbyTitleDesc" },
  { key: "lobby_subtitle",       labelKey: "settings.msgLobbySubtitle",       descKey: "settings.msgLobbySubtitleDesc" },
  { key: "lobby_waiting",        labelKey: "settings.msgLobbyWaiting",        descKey: "settings.msgLobbyWaitingDesc",        multiline: true },
  { key: "completion_title",     labelKey: "settings.msgCompletionTitle",     descKey: "settings.msgCompletionTitleDesc" },
  { key: "completion_subtitle",  labelKey: "settings.msgCompletionSubtitle",  descKey: "settings.msgCompletionSubtitleDesc",  multiline: true },
  { key: "registration_welcome", labelKey: "settings.msgRegWelcome",          descKey: "settings.msgRegWelcomeDesc",          multiline: true },
];

function SettingsPage() {
  const { user } = useAuth();
  const { t } = useI18n();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-7 w-7 text-primary" /> {t("nav.settings")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("settings.desc")}</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="flex h-auto flex-wrap gap-1 bg-muted/60 p-1 rounded-xl w-full">
          <TabsTrigger value="profile" className="flex-1 min-w-[80px] gap-1.5 text-xs sm:text-sm">
            <User className="h-4 w-4 shrink-0" /> <span className="truncate">{t("settings.profile")}</span>
          </TabsTrigger>
          <TabsTrigger value="registration" className="flex-1 min-w-[80px] gap-1.5 text-xs sm:text-sm">
            <ListChecks className="h-4 w-4 shrink-0" /> <span className="truncate">{t("settings.registration")}</span>
          </TabsTrigger>
          <TabsTrigger value="scoring" className="flex-1 min-w-[80px] gap-1.5 text-xs sm:text-sm">
            <Trophy className="h-4 w-4 shrink-0" /> <span className="truncate">{t("settings.scoring")}</span>
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex-1 min-w-[80px] gap-1.5 text-xs sm:text-sm">
            <MessageSquare className="h-4 w-4 shrink-0" /> <span className="truncate">{t("settings.messages")}</span>
          </TabsTrigger>
          <TabsTrigger value="plan" className="flex-1 min-w-[80px] gap-1.5 text-xs sm:text-sm">
            <CreditCard className="h-4 w-4 shrink-0" /> <span className="truncate">{t("settings.plan")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          {user && <ProfileForm userId={user.id} />}
        </TabsContent>
        <TabsContent value="registration" className="mt-4">
          {user && <HostSettingsForm userId={user.id} section="registration" />}
        </TabsContent>
        <TabsContent value="scoring" className="mt-4">
          {user && <HostSettingsForm userId={user.id} section="scoring" />}
        </TabsContent>
        <TabsContent value="messages" className="mt-4">
          {user && <MessagesForm userId={user.id} />}
        </TabsContent>
        <TabsContent value="plan" className="mt-4">
          {user && <PlanSection userId={user.id} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PLAN SECTION - fully DB-driven, no hardcoded plan data
// ─────────────────────────────────────────────────────────────────
const LIMIT_ROWS: { label: string; key: string }[] = [
  { label: "Quizzes / day",          key: "quizzes_per_day" },
  { label: "AI calls / day",         key: "ai_calls_per_day" },
  { label: "Participants / session",  key: "participants_per_session" },
  { label: "Question bank",          key: "question_bank" },
  { label: "Total sessions",         key: "sessions_total" },
];

function limitLabel(v: number) { return v === -1 ? "Unlimited" : v.toLocaleString(); }

type DbPlan = {
  id: string; slug: string; name: string; description: string | null;
  price_monthly: number; price_yearly: number;
  features: string[]; limits: Record<string, number>;
  stripe_price_id_monthly: string | null;
};


function PlanSection({ userId }: { userId: string }) {
  const { plan: ctxPlan, usage, usedPct } = usePlan();
  const { t } = useI18n();
  const [plans, setPlans] = useState<DbPlan[]>([]);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [targetSlug, setTargetSlug] = useState<string | undefined>(undefined);

  useEffect(() => {
    supabase.from("plans").select("*").eq("is_active", true).order("sort_order")
      .then(({ data }) => {
        if (data) setPlans(data.map((p) => ({
          ...p,
          features: (p.features as string[]) ?? [],
          limits: (p.limits as Record<string, number>) ?? {},
        })));
      });
  }, []);

  const openUpgrade = (slug?: string) => { setTargetSlug(slug); setShowUpgrade(true); };

  const usageItems = [
    { label: "Quizzes today",  used: usage.quizzes_today,   pct: usedPct("quizzes_per_day"),  limit: ctxPlan?.limits.quizzes_per_day ?? 5 },
    { label: "AI calls today", used: usage.ai_calls_today,  pct: usedPct("ai_calls_per_day"), limit: ctxPlan?.limits.ai_calls_per_day ?? 3 },
    { label: "Total sessions", used: usage.sessions_total,  pct: usedPct("sessions_total"),   limit: ctxPlan?.limits.sessions_total ?? 20 },
    { label: "Question bank",  used: usage.questions_total, pct: usedPct("question_bank"),    limit: ctxPlan?.limits.question_bank ?? 100 },
  ];

  return (
    <div className="space-y-6">
      {/* ── Current plan card ── */}
      <div className="rounded-2xl border border-primary/30 bg-card/60 p-5 shadow-glow">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-xl capitalize">{ctxPlan?.name ?? "Free"} {t("settings.plan")}</span>
              <Badge className="bg-primary/15 text-primary border-0 text-[10px]">{t("settings.currentPlanLabel")}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ctxPlan?.price_monthly === 0 ? t("settings.freeForever") : `$${ctxPlan?.price_monthly ?? 0}/mo · $${ctxPlan?.price_yearly ?? 0}/yr`}
            </p>
          </div>
          {ctxPlan?.slug !== "enterprise" && (
            <Button size="sm" className="bg-gradient-primary text-primary-foreground shadow-glow gap-1.5" onClick={() => openUpgrade()}>
              {t("plan.upgradeBtn")}
            </Button>
          )}
        </div>

        {/* Usage bars */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {usageItems.map((item) => {
            const danger = item.pct >= 80 && item.limit !== -1;
            const unlimited = item.limit === -1;
            return (
              <div key={item.label} className="rounded-xl border border-border bg-card/30 p-3">
                <div className="text-[10px] text-muted-foreground mb-1">{item.label}</div>
                <div className={`text-sm font-semibold mb-1.5 ${danger ? "text-destructive" : ""}`}>
                  {item.used}
                  <span className="text-muted-foreground font-normal"> / {unlimited ? "∞" : item.limit}</span>
                </div>
                {unlimited ? (
                  <div className="h-1 rounded-full bg-success/30"><div className="h-full w-full rounded-full bg-success/50" /></div>
                ) : (
                  <Progress value={item.pct} className={`h-1 ${danger ? "[&>div]:bg-destructive" : ""}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Billing toggle ── */}
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm ${billing === "monthly" ? "text-foreground font-medium" : "text-muted-foreground"}`}>{t("plan.monthly")}</span>
        <button type="button"
          onClick={() => setBilling((b) => b === "monthly" ? "yearly" : "monthly")}
          className={`relative h-6 w-11 rounded-full transition-colors ${billing === "yearly" ? "bg-primary" : "bg-muted"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${billing === "yearly" ? "left-[22px]" : "left-0.5"}`} />
        </button>
        <span className={`text-sm ${billing === "yearly" ? "text-foreground font-medium" : "text-muted-foreground"}`}>
          {t("plan.yearly")} <Badge className="bg-success/15 text-success border-0 text-[10px] ml-1">{t("plan.savePercent")}</Badge>
        </span>
      </div>

      {/* ── Plan cards - DB driven ── */}
      {plans.length === 0 ? (
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map((i) => <div key={i} className="h-64 rounded-2xl bg-muted/30 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = ctxPlan?.slug === plan.slug;
            const price = billing === "yearly" ? plan.price_yearly : plan.price_monthly;
            return (
              <div key={plan.id}
                className={`relative rounded-2xl border p-5 flex flex-col gap-4 transition-all duration-300 hover:shadow-glow hover:scale-[1.02] ${
                  isCurrent ? "border-primary/60 bg-primary/5 shadow-glow" : "border-border bg-card/40"
                }`}>
                {plan.slug === "pro" && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 shadow-glow">
                    {t("plan.mostPopular")}
                  </span>
                )}

                {/* Name */}
                <div className="flex items-center gap-2">
                  <div className={`rounded-xl p-2 ${isCurrent ? "bg-primary/20" : "bg-muted/40"}`}>
                    <CreditCard className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-display font-bold">{plan.name}</span>
                  {isCurrent && <Badge className="ml-auto bg-primary/20 text-primary border-0 text-[9px]">{t("settings.activePlan")}</Badge>}
                </div>

                {/* Price */}
                <div>
                  <span className="font-display text-3xl font-bold">
                    {price === 0 ? "Free" : `$${price}`}
                  </span>
                  {price > 0 && (
                    <span className="text-xs text-muted-foreground ml-1">/{billing === "yearly" ? "yr" : "mo"}</span>
                  )}
                  {plan.description && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{plan.description}</p>
                  )}
                </div>

                {/* Features - from DB */}
                <ul className="space-y-1.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Check className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />{f}
                    </li>
                  ))}
                </ul>

                <Button
                  size="sm"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent}
                  onClick={() => openUpgrade(plan.slug)}
                  className={`w-full gap-1.5 ${!isCurrent ? "bg-gradient-primary text-primary-foreground shadow-glow" : ""}`}
                >
                  {isCurrent ? t("plan.currentPlan") : `${t("plan.upgradeTo")} ${plan.name}`}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Compare table - DB driven ── */}
      {plans.length > 0 && (
        <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/20 text-sm font-semibold">{t("plan.comparison")}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/10">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs w-40">{t("settings.limitColHeader")}</th>
                  {plans.map((p) => (
                    <th key={p.id} className={`px-4 py-3 text-center text-xs font-semibold ${ctxPlan?.slug === p.slug ? "text-primary" : "text-foreground"}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {LIMIT_ROWS.map((row) => (
                  <tr key={row.key} className="hover:bg-muted/10">
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">{row.label}</td>
                    {plans.map((p) => (
                      <td key={p.id} className={`px-4 py-2.5 text-center text-xs font-medium ${ctxPlan?.slug === p.slug ? "text-primary" : ""}`}>
                        {limitLabel(p.limits[row.key] ?? 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        {t("plan.secure")}{" "}
        <a href="mailto:support@evalutease.com" className="text-primary underline-offset-4 hover:underline">
          {t("plan.contact")}
        </a>
      </p>

      <LazyUpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} targetSlug={targetSlug} />
    </div>
  );
}

function MessagesForm({ userId }: { userId: string }) {
  const { t } = useI18n();
  const storageKey = `app_messages_${userId}`;
  const [messages, setMessages] = useState<AppMessages>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return { ...DEFAULT_MESSAGES, ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return { ...DEFAULT_MESSAGES };
  });
  const [saving, setSaving] = useState(false);

  const save = () => {
    setSaving(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
      toast.success(t("settings.messagesSaved"));
    } catch {
      toast.error("Failed to save messages");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setMessages({ ...DEFAULT_MESSAGES });
    localStorage.removeItem(storageKey);
    toast.success(t("settings.messagesReset"));
  };

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-5">
      <div>
        <h3 className="font-semibold">{t("settings.messagesTitle")}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t("settings.messagesDesc")}</p>
      </div>

      <div className="space-y-4">
        {MESSAGE_FIELD_KEYS.map((f) => (
          <div key={f.key}>
            <Label className="mb-1">{t(f.labelKey)}</Label>
            <p className="text-xs text-muted-foreground mb-1.5">{t(f.descKey)}</p>
            {f.multiline ? (
              <Textarea
                value={messages[f.key]}
                onChange={(e) => setMessages((prev) => ({ ...prev, [f.key]: e.target.value }))}
                rows={2}
                className="resize-none"
              />
            ) : (
              <Input
                value={messages[f.key]}
                onChange={(e) => setMessages((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2 border-t border-border">
        <Button
          onClick={save}
          disabled={saving}
          className="bg-gradient-primary text-primary-foreground shadow-glow"
        >
          {saving ? t("settings.saving") : t("settings.saveMessages")}
        </Button>
        <Button variant="outline" onClick={reset}>
          {t("settings.resetDefaults")}
        </Button>
      </div>
    </div>
  );
}

const ROLES_OPTS     = ["Student", "Teacher", "Employer", "Other"] as const;
const USE_CASES_OPTS = ["Education", "Sports", "Fun", "Religion", "Science", "Academic"] as const;
const REFERRALS_OPTS = ["Ads", "Friend Recommendation", "Employee Referral", "Web Search"] as const;
const REFERRAL_KEYS_MAP: Record<string, string> = {
  "Ads": "signup.referral.ads",
  "Friend Recommendation": "signup.referral.friend",
  "Employee Referral": "signup.referral.employee",
  "Web Search": "signup.referral.webSearch",
};
const INDUSTRIES_OPTS = ["Education", "Technology", "Healthcare", "Finance", "Retail", "Government", "Non-profit", "Other"] as const;
const TEAM_SIZES_OPTS = ["Just me", "2–10", "11–50", "51–200", "200+"] as const;
const GRADE_YEARS_OPTS = ["Grade 1–5", "Grade 6–8", "Grade 9–10", "Grade 11–12", "Undergraduate", "Postgraduate", "PhD", "Other"] as const;

function ProfileForm({ userId }: { userId: string }) {
  const { t } = useI18n();
  const tUseCase = (uc: string) => t(`signup.useCase.${uc.toLowerCase()}`);
  const tReferral = (r: string) => t(REFERRAL_KEYS_MAP[r] ?? r);
  const tRole = (r: string) => t(`signup.role.${r.toLowerCase()}`);
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    organization: "",
    mobile: "",
    country: "",
    avatar_url: "",
    logo_url: "",
    // new fields
    role: "",
    use_cases: [] as string[],
    referral: "",
    school: "",
    grade_year: "",
    field_of_study: "",
    institution: "",
    subject_taught: "",
    years_exp: "",
    company_name: "",
    industry: "",
    team_size: "",
    other_details: "",
  });
  const [uploading, setUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const d = data as Record<string, unknown>;
        setProfile({
          first_name:    (d.first_name    as string) ?? "",
          last_name:     (d.last_name     as string) ?? "",
          organization:  (d.organization  as string) ?? "",
          mobile:        (d.mobile        as string) ?? "",
          country:       (d.country       as string) ?? "",
          avatar_url:    (d.avatar_url    as string) ?? "",
          logo_url:      (d.logo_url      as string) ?? "",
          role:          (d.role          as string) ?? "",
          use_cases:     Array.isArray(d.use_cases) ? (d.use_cases as string[]) : [],
          referral:      (d.referral      as string) ?? "",
          school:        (d.school        as string) ?? "",
          grade_year:    (d.grade_year    as string) ?? "",
          field_of_study:(d.field_of_study as string) ?? "",
          institution:   (d.institution   as string) ?? "",
          subject_taught:(d.subject_taught as string) ?? "",
          years_exp:     (d.years_exp     as string) ?? "",
          company_name:  (d.company_name  as string) ?? "",
          industry:      (d.industry      as string) ?? "",
          team_size:     (d.team_size     as string) ?? "",
          other_details: (d.other_details as string) ?? "",
        });
      });
  }, [userId]);

  const name = `${profile.first_name} ${profile.last_name}`.trim() || "User";
  const initials = name.slice(0, 2).toUpperCase();

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Profile picture must be under 3 MB");
      return;
    }
    setUploading(true);
    const optimized = await optimizeAvatar(file).catch(() => file);
    const path = `${userId}/avatar-${Date.now()}.webp`;
    const { error } = await supabase.storage.from("avatars").upload(path, optimized, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) {
      setUploading(false);
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatar_url = data.publicUrl;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url })
      .eq("id", userId);
    setUploading(false);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    setProfile((prev) => ({ ...prev, avatar_url }));
    toast.success("Profile picture updated");
  };

  const uploadLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file"); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error("Logo must be under 3 MB"); return; }
    setUploadingLogo(true);
    const optimized = await optimizeLogo(file).catch(() => file);
    const path = `${userId}/logo-${Date.now()}.webp`;
    const { error } = await supabase.storage.from("avatars").upload(path, optimized, { cacheControl: "3600", upsert: true });
    if (error) { setUploadingLogo(false); toast.error(error.message); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const logo_url = data.publicUrl;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase.from("profiles") as any).update({ logo_url }).eq("id", userId);
    setUploadingLogo(false);
    if (updateError) { toast.error(updateError.message); return; }
    setProfile((prev) => ({ ...prev, logo_url }));
    toast.success("Logo updated - refresh to see it in the navbar");
  };

  const set = (k: keyof Omit<typeof profile, "use_cases" | "avatar_url" | "logo_url">) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setProfile(p => ({ ...p, [k]: e.target.value }));

  const toggleUseCase = (val: string) =>
    setProfile(p => ({
      ...p,
      use_cases: p.use_cases.includes(val)
        ? p.use_cases.filter(u => u !== val)
        : [...p.use_cases, val],
    }));

  const save = async () => {
    setSaving(true);
    const full_name = `${profile.first_name} ${profile.last_name}`.trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("profiles") as any)
      .update({ ...profile, full_name })
      .eq("id", userId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved");
  };

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="h-20 w-20 border border-primary/30">
          {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
          <AvatarFallback className="bg-primary/15 text-primary text-xl font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <Label htmlFor="avatar-upload" className="mb-1.5 block">
            {t("settings.profilePicture")}
          </Label>
          <Input
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="max-w-xs"
            disabled={uploading}
            onChange={(e) => void uploadAvatar(e.target.files?.[0])}
          />
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Upload className="h-3.5 w-3.5" />{" "}
            {uploading ? t("settings.uploading") : t("settings.avatarUploadHint")}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5">{t("auth.firstName")}</Label>
          <Input
            value={profile.first_name}
            onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
          />
        </div>
        <div>
          <Label className="mb-1.5">{t("auth.lastName")}</Label>
          <Input
            value={profile.last_name}
            onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label className="mb-1.5">{t("auth.organization")}</Label>
        <Input
          value={profile.organization}
          onChange={(e) => setProfile({ ...profile, organization: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5">{t("auth.mobile")}</Label>
          <Input value={profile.mobile} onChange={(e) => setProfile({ ...profile, mobile: e.target.value })} />
        </div>
        <div>
          <Label className="mb-1.5">{t("settings.country")}</Label>
          <Input value={profile.country} onChange={(e) => setProfile({ ...profile, country: e.target.value })} />
        </div>
      </div>

      {/* ── Role & background ── */}
      <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-4">
        <h3 className="text-sm font-semibold">{t("settings.aboutYou")}</h3>

        {/* Role */}
        <div>
          <Label className="mb-1.5 text-xs">{t("settings.iAmA")}</Label>
          <select
            value={profile.role}
            onChange={set("role")}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="" disabled>{t("signup.selectRole")}</option>
            {ROLES_OPTS.map(r => <option key={r} value={r}>{tRole(r)}</option>)}
          </select>
        </div>

        {/* Role-specific fields */}
        {profile.role === "Student" && (
          <div className="space-y-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">{t("settings.studentDetails")}</p>
            <div>
              <Label className="mb-1.5 text-xs">School / University</Label>
              <Input value={profile.school} onChange={set("school")} placeholder="e.g. University of Karachi" className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 text-xs">Grade / Year</Label>
                <select value={profile.grade_year} onChange={set("grade_year")} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="" disabled>Select</option>
                  {GRADE_YEARS_OPTS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1.5 text-xs">Field of Study</Label>
                <Input value={profile.field_of_study} onChange={set("field_of_study")} placeholder="e.g. Computer Science" className="h-9 text-sm" />
              </div>
            </div>
          </div>
        )}

        {profile.role === "Teacher" && (
          <div className="space-y-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">{t("settings.teacherDetails")}</p>
            <div>
              <Label className="mb-1.5 text-xs">Institution / School Name</Label>
              <Input value={profile.institution} onChange={set("institution")} placeholder="e.g. Beaconhouse School" className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 text-xs">Subject Taught</Label>
                <Input value={profile.subject_taught} onChange={set("subject_taught")} placeholder="e.g. Mathematics" className="h-9 text-sm" />
              </div>
              <div>
                <Label className="mb-1.5 text-xs">Years of Experience</Label>
                <Input value={profile.years_exp} onChange={set("years_exp")} type="number" min="0" max="50" placeholder="e.g. 5" className="h-9 text-sm" />
              </div>
            </div>
          </div>
        )}

        {profile.role === "Employer" && (
          <div className="space-y-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/15">
            <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">{t("settings.employerDetails")}</p>
            <div>
              <Label className="mb-1.5 text-xs">{t("settings.companyName")}</Label>
              <Input value={profile.company_name} onChange={set("company_name")} placeholder="e.g. Acme Corp" className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 text-xs">{t("settings.industry")}</Label>
                <select value={profile.industry} onChange={set("industry")} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="" disabled>Select</option>
                  {INDUSTRIES_OPTS.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-1.5 text-xs">{t("settings.teamSize")}</Label>
                <select value={profile.team_size} onChange={set("team_size")} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option value="" disabled>Select</option>
                  {TEAM_SIZES_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {profile.role === "Other" && (
          <div className="space-y-2 p-3 rounded-xl bg-purple-500/5 border border-purple-500/15">
            <p className="text-xs font-semibold text-purple-400 uppercase tracking-wide">{t("signup.other.details")}</p>
            <textarea
              value={profile.other_details}
              onChange={set("other_details")}
              rows={3}
              placeholder="Describe how you use EvaluTease..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>
        )}

        {/* Use cases */}
        <div>
          <Label className="mb-2 text-xs block">{t("settings.useFor")}</Label>
          <div className="flex flex-wrap gap-2">
            {USE_CASES_OPTS.map(uc => {
              const active = profile.use_cases.includes(uc);
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
                  {active && <Check className="inline h-3 w-3 mr-1" />}{tUseCase(uc)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Referral */}
        <div>
          <Label className="mb-1.5 text-xs">{t("signup.hearAbout")}</Label>
          <select
            value={profile.referral}
            onChange={set("referral")}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Select an option</option>
            {REFERRALS_OPTS.map(r => <option key={r} value={r}>{tReferral(r)}</option>)}
          </select>
        </div>
      </div>

      {/* Custom logo / branding section - gated on plan */}
      <BrandingBlock
        profile={profile}
        setProfile={setProfile}
        userId={userId}
        uploadLogo={uploadLogo}
        uploadingLogo={uploadingLogo}
      />

      <Button
        onClick={save}
        disabled={saving}
        className="bg-gradient-primary text-primary-foreground shadow-glow"
      >
        {saving ? t("settings.saving") : t("settings.saveChanges")}
      </Button>
    </div>
  );
}

// ── Branding block - shown in ProfileForm, locked on Free plan ────────────────
function BrandingBlock({
  profile, setProfile, userId, uploadLogo, uploadingLogo,
}: {
  profile: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setProfile: (fn: (p: any) => any) => void;
  userId: string;
  uploadLogo: (f: File | undefined) => Promise<void>;
  uploadingLogo: boolean;
}) {
  const { plan } = usePlan();
  const { t } = useI18n();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const canBrand = (plan?.limits.custom_branding ?? 0) === 1;

  return (
    <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-semibold flex items-center gap-2">
            {t("settings.branding")}
            {!canBrand && (
              <span className="text-[10px] bg-warning/20 text-warning border border-warning/30 rounded-full px-2 py-0.5 font-semibold">{t("common.proPlus")}</span>
            )}
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {canBrand ? t("settings.brandingDesc") : t("settings.brandingLocked")}
          </p>
        </div>
        {!canBrand && (
          <button type="button" onClick={() => setShowUpgrade(true)} className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0">
            <Lock className="h-3 w-3" /> {t("limit.upgrade")}
          </button>
        )}
      </div>

      {canBrand ? (
        <div className="flex items-center gap-4 flex-wrap">
          {profile.logo_url ? (
            <div className="h-12 w-auto rounded-xl border border-border bg-card/60 overflow-hidden flex items-center px-3">
              <img src={String(profile.logo_url)} alt="Custom logo" className="h-8 w-auto object-contain max-w-[120px]" />
            </div>
          ) : (
            <div className="h-12 w-24 rounded-xl border border-dashed border-border bg-card/30 flex items-center justify-center text-[10px] text-muted-foreground">
              {t("settings.noLogo")}
            </div>
          )}
          <div>
            <Input id="logo-upload" type="file" accept="image/*" className="max-w-xs" disabled={uploadingLogo}
              onChange={(e) => void uploadLogo(e.target.files?.[0])} />
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Upload className="h-3.5 w-3.5" />
              {uploadingLogo ? t("settings.uploading") : t("settings.logoUploadHint")}
            </div>
          </div>
          {!!profile.logo_url && (
            <button type="button" className="text-xs text-destructive hover:underline"
              onClick={async () => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("profiles") as any).update({ logo_url: "" }).eq("id", userId);
                setProfile((p: Record<string, unknown>) => ({ ...p, logo_url: "" }));
                toast.success("Logo removed");
              }}>
              {t("settings.removeLogo")}
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-lg bg-muted/30 border border-dashed border-border p-4 flex items-center gap-3 opacity-60">
          <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">{t("settings.brandingLocked")}</span>
        </div>
      )}

      <LazyUpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} lockedFeature="Custom branding" targetSlug="pro" />
    </div>
  );
}

function HostSettingsForm({
  userId,
  section,
}: {
  userId: string;
  section: "registration" | "scoring";
}) {
  const { t } = useI18n();
  const [settings, setSettings] = useState<HostSettings>(() => defaultHostSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("host_settings")
      .select("*")
      .eq("owner_id", userId)
      .maybeSingle();
    if (data) {
      setSettings({
        registration_fields: normalizeRegistrationFields(data.registration_fields),
        marks_per_correct: data.marks_per_correct ?? 1,
        speed_bonus_enabled: data.speed_bonus_enabled ?? false,
        speed_bonus_max: data.speed_bonus_max ?? 1,
        show_explanation: data.show_explanation ?? true,
      });
    } else {
      setSettings(defaultHostSettings());
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    const payload = {
      owner_id: userId,
      registration_fields: settings.registration_fields,
      marks_per_correct: settings.marks_per_correct,
      speed_bonus_enabled: settings.speed_bonus_enabled,
      speed_bonus_max: settings.speed_bonus_max,
      show_explanation: settings.show_explanation,
    };
    const { error } = await supabase
      .from("host_settings")
      .upsert(payload, { onConflict: "owner_id" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("settings.saveChanges"));
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-5">
      {section === "registration" ? (
        <RegistrationFieldsEditor
          value={settings.registration_fields}
          onChange={(rf) => setSettings({ ...settings, registration_fields: rf })}
        />
      ) : (
        <ScoringEditor value={settings} onChange={(s) => setSettings({ ...settings, ...s })} />
      )}

      <Button
        onClick={save}
        disabled={saving}
        className="bg-gradient-primary text-primary-foreground shadow-glow"
      >
        {saving ? t("settings.saving") : t("settings.saveChanges")}
      </Button>
    </div>
  );
}

function RegistrationFieldsEditor({
  value,
  onChange,
}: {
  value: HostSettings["registration_fields"];
  onChange: (next: HostSettings["registration_fields"]) => void;
}) {
  const { t } = useI18n();
  const update = (
    key: RegistrationFieldKey,
    patch: Partial<{ visible: boolean; required: boolean }>,
  ) => {
    const next = { ...value, [key]: { ...value[key], ...patch } };
    if (key === "name") {
      next.name = { visible: true, required: true };
    } else if (!next[key].visible) {
      next[key].required = false;
    }
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold">{t("settings.registrationTitle")}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t("settings.registrationDesc")}</p>
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] items-center px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
          <span>{t("settings.colField")}</span>
          <span className="px-3">{t("settings.colVisible")}</span>
          <span className="px-3">{t("settings.colRequired")}</span>
        </div>
        <ul className="divide-y divide-border/60">
          {REGISTRATION_FIELD_KEYS.map((key) => {
            const cfg = value[key];
            const isName = key === "name";
            return (
              <li
                key={key}
                className="grid grid-cols-[1fr_auto_auto] items-center px-4 py-2.5 hover:bg-muted/20"
              >
                <span className="text-sm font-medium">
                  {REGISTRATION_FIELD_LABELS[key]}
                  {isName && (
                    <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                      {t("settings.alwaysOn")}
                    </span>
                  )}
                </span>
                <div className="px-3">
                  <Switch
                    checked={cfg.visible}
                    disabled={isName}
                    onCheckedChange={(v) => update(key, { visible: v })}
                  />
                </div>
                <div className="px-3">
                  <Switch
                    checked={cfg.required}
                    disabled={isName || !cfg.visible}
                    onCheckedChange={(v) => update(key, { required: v })}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">{t("settings.registrationNote")}</p>
    </div>
  );
}

function ScoringEditor({
  value,
  onChange,
}: {
  value: HostSettings;
  onChange: (
    next: Partial<
      Pick<
        HostSettings,
        "marks_per_correct" | "speed_bonus_enabled" | "speed_bonus_max" | "show_explanation"
      >
    >,
  ) => void;
}) {
  const { plan } = usePlan();
  const { t } = useI18n();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const canCustomMarking   = (plan?.limits.custom_marking   ?? 0) === 1;
  const canCustomTimeBonus = (plan?.limits.custom_time_bonus ?? 0) === 1;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold">{t("settings.scoringTitle")}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t("settings.scoringDesc")}</p>
      </div>

      {/* Marks per question */}
      <div className="relative">
        <Label className="mb-1.5 flex items-center gap-2">
          {t("settings.marksPerQ")}
          {!canCustomMarking && (
            <span className="text-[10px] bg-warning/20 text-warning border border-warning/30 rounded-full px-2 py-0.5 font-semibold">Pro+</span>
          )}
        </Label>
        {canCustomMarking ? (
          <Input
            type="number" min={1} max={100}
            value={value.marks_per_correct}
            onChange={(e) => onChange({ marks_per_correct: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })}
            className="w-32"
          />
        ) : (
          <div className="flex items-center gap-3">
            <Input value={1} disabled className="w-32 opacity-50" />
            <button type="button" onClick={() => setShowUpgrade(true)} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Lock className="h-3 w-3" /> {t("limit.upgradeToCustomise")}
            </button>
          </div>
        )}
        {!canCustomMarking && (
          <p className="text-xs text-muted-foreground mt-1">{t("settings.marksFreeLocked")}</p>
        )}
      </div>

      {/* Speed bonus */}
      <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              {t("settings.speedBonus")}
              {!canCustomTimeBonus && (
                <span className="text-[10px] bg-warning/20 text-warning border border-warning/30 rounded-full px-2 py-0.5 font-semibold">Pro+</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {canCustomTimeBonus ? t("settings.speedBonusDesc") : t("settings.speedBonusFreeNote")}
            </p>
          </div>
          {canCustomTimeBonus ? (
            <Switch checked={value.speed_bonus_enabled} onCheckedChange={(v) => onChange({ speed_bonus_enabled: v })} />
          ) : (
            <button type="button" onClick={() => setShowUpgrade(true)} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Lock className="h-3 w-3" /> {t("limit.upgrade")}
            </button>
          )}
        </div>
        {canCustomTimeBonus && value.speed_bonus_enabled && (
          <div>
            <Label className="mb-1.5">{t("settings.maxBonusPerSession")}</Label>
            <Input
              type="number" min={1} max={100}
              value={value.speed_bonus_max}
              onChange={(e) => onChange({ speed_bonus_max: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })}
              className="w-32"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/40 p-4">
        <div>
          <div className="text-sm font-semibold">{t("settings.showExplanation")}</div>
          <p className="text-xs text-muted-foreground mt-0.5">{t("settings.showExplanationDesc")}</p>
        </div>
        <Switch checked={value.show_explanation} onCheckedChange={(v) => onChange({ show_explanation: v })} />
      </div>

      <LazyUpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} lockedFeature="Custom scoring" targetSlug="pro" />
    </div>
  );
}
