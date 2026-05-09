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
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
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
import { UpgradeModal } from "@/components/UpgradeModal";
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

const MESSAGE_FIELDS: { key: keyof AppMessages; label: string; description: string; multiline?: boolean }[] = [
  { key: "lobby_title", label: "Lobby Title", description: "Main heading shown in the waiting room." },
  { key: "lobby_subtitle", label: "Lobby Subtitle", description: "Supporting text below the lobby title." },
  { key: "lobby_waiting", label: "Lobby Waiting Message", description: "Status message shown while waiting for the host to start.", multiline: true },
  { key: "completion_title", label: "Completion Title", description: "Heading shown when a participant finishes the quiz." },
  { key: "completion_subtitle", label: "Completion Subtitle", description: "Text shown below the score when quiz is complete.", multiline: true },
  { key: "registration_welcome", label: "Registration Welcome", description: "Text shown at the top of the participant registration screen.", multiline: true },
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
        <p className="text-muted-foreground mt-1">
          Profile, registration form, scoring rules, and custom messages.
        </p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="h-4 w-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="registration" className="gap-1.5">
            <ListChecks className="h-4 w-4" /> Registration
          </TabsTrigger>
          <TabsTrigger value="scoring" className="gap-1.5">
            <Trophy className="h-4 w-4" /> Scoring
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-1.5">
            <MessageSquare className="h-4 w-4" /> Messages
          </TabsTrigger>
          <TabsTrigger value="plan" className="gap-1.5">
            <CreditCard className="h-4 w-4" /> Plan
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
// PLAN SECTION — fully DB-driven, no hardcoded plan data
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
              <span className="font-display font-bold text-xl capitalize">{ctxPlan?.name ?? "Free"} Plan</span>
              <Badge className="bg-primary/15 text-primary border-0 text-[10px]">Current</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ctxPlan?.price_monthly === 0 ? "Free forever" : `$${ctxPlan?.price_monthly ?? 0}/mo · $${ctxPlan?.price_yearly ?? 0}/yr`}
            </p>
          </div>
          {ctxPlan?.slug !== "enterprise" && (
            <Button size="sm" className="bg-gradient-primary text-primary-foreground shadow-glow gap-1.5" onClick={() => openUpgrade()}>
              Upgrade Plan
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
        <span className={`text-sm ${billing === "monthly" ? "text-foreground font-medium" : "text-muted-foreground"}`}>Monthly</span>
        <button type="button"
          onClick={() => setBilling((b) => b === "monthly" ? "yearly" : "monthly")}
          className={`relative h-6 w-11 rounded-full transition-colors ${billing === "yearly" ? "bg-primary" : "bg-muted"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${billing === "yearly" ? "left-[22px]" : "left-0.5"}`} />
        </button>
        <span className={`text-sm ${billing === "yearly" ? "text-foreground font-medium" : "text-muted-foreground"}`}>
          Yearly <Badge className="bg-success/15 text-success border-0 text-[10px] ml-1">Save ~30%</Badge>
        </span>
      </div>

      {/* ── Plan cards — DB driven ── */}
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
                    Most Popular
                  </span>
                )}

                {/* Name */}
                <div className="flex items-center gap-2">
                  <div className={`rounded-xl p-2 ${isCurrent ? "bg-primary/20" : "bg-muted/40"}`}>
                    <CreditCard className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-display font-bold">{plan.name}</span>
                  {isCurrent && <Badge className="ml-auto bg-primary/20 text-primary border-0 text-[9px]">Active</Badge>}
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

                {/* Features — from DB */}
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
                  {isCurrent ? "Current Plan" : `Upgrade to ${plan.name}`}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Compare table — DB driven ── */}
      {plans.length > 0 && (
        <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/20 text-sm font-semibold">Plan Comparison</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/10">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium text-xs w-40">Limit</th>
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
        Secure payments via Stripe · Cancel anytime ·{" "}
        <a href="mailto:support@evalutease.com" className="text-primary underline-offset-4 hover:underline">
          Contact support
        </a>
      </p>

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} targetSlug={targetSlug} />
    </div>
  );
}

function MessagesForm({ userId }: { userId: string }) {
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
      toast.success("Messages saved");
    } catch {
      toast.error("Failed to save messages");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setMessages({ ...DEFAULT_MESSAGES });
    localStorage.removeItem(storageKey);
    toast.success("Messages reset to defaults");
  };

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-5">
      <div>
        <h3 className="font-semibold">Customize App Messages</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Personalize the text shown to participants in the lobby, registration, and completion screens.
        </p>
      </div>

      <div className="space-y-4">
        {MESSAGE_FIELDS.map((f) => (
          <div key={f.key}>
            <Label className="mb-1">{f.label}</Label>
            <p className="text-xs text-muted-foreground mb-1.5">{f.description}</p>
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
          {saving ? "Saving…" : "Save messages"}
        </Button>
        <Button variant="outline" onClick={reset}>
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}

function ProfileForm({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    organization: "",
    mobile: "",
    country: "",
    avatar_url: "",
    logo_url: "",
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
        if (data)
          setProfile({
            first_name: data.first_name ?? "",
            last_name: data.last_name ?? "",
            organization: data.organization ?? "",
            mobile: data.mobile ?? "",
            country: data.country ?? "",
            avatar_url: data.avatar_url ?? "",
            logo_url: (data as Record<string, unknown>).logo_url as string ?? "",
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
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, {
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
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${userId}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { cacheControl: "3600", upsert: true });
    if (error) { setUploadingLogo(false); toast.error(error.message); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const logo_url = data.publicUrl;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase.from("profiles") as any).update({ logo_url }).eq("id", userId);
    setUploadingLogo(false);
    if (updateError) { toast.error(updateError.message); return; }
    setProfile((prev) => ({ ...prev, logo_url }));
    toast.success("Logo updated — refresh to see it in the navbar");
  };

  const save = async () => {
    setSaving(true);
    const full_name = `${profile.first_name} ${profile.last_name}`.trim();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("profiles") as any)
      .update({ ...profile, full_name })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
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
            Profile picture
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
            {uploading ? "Uploading..." : "JPG, PNG, or WebP up to 3 MB"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5">{t("auth.mobile")}</Label>
          <Input
            value={profile.mobile}
            onChange={(e) => setProfile({ ...profile, mobile: e.target.value })}
          />
        </div>
        <div>
          <Label className="mb-1.5">Country</Label>
          <Input
            value={profile.country}
            onChange={(e) => setProfile({ ...profile, country: e.target.value })}
          />
        </div>
      </div>
      {/* Custom logo section */}
      <div className="rounded-xl border border-border bg-muted/10 p-4 space-y-3">
        <div>
          <Label className="text-sm font-semibold">Custom Logo (Branding)</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload your organisation logo. It will appear in the navigation bar instead of the default logo.
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {profile.logo_url ? (
            <div className="h-12 w-auto rounded-xl border border-border bg-card/60 overflow-hidden flex items-center px-3">
              <img src={profile.logo_url} alt="Custom logo" className="h-8 w-auto object-contain max-w-[120px]" />
            </div>
          ) : (
            <div className="h-12 w-24 rounded-xl border border-dashed border-border bg-card/30 flex items-center justify-center text-[10px] text-muted-foreground">
              No logo
            </div>
          )}
          <div>
            <Input
              id="logo-upload"
              type="file"
              accept="image/*"
              className="max-w-xs"
              disabled={uploadingLogo}
              onChange={(e) => void uploadLogo(e.target.files?.[0])}
            />
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Upload className="h-3.5 w-3.5" />
              {uploadingLogo ? "Uploading…" : "PNG, SVG, WebP up to 3 MB"}
            </div>
          </div>
          {profile.logo_url && (
            <button
              type="button"
              onClick={async () => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from("profiles") as any).update({ logo_url: "" }).eq("id", userId);
                setProfile((prev) => ({ ...prev, logo_url: "" }));
                toast.success("Logo removed");
              }}
              className="text-xs text-destructive hover:underline"
            >
              Remove logo
            </button>
          )}
        </div>
      </div>

      <Button
        onClick={save}
        disabled={saving}
        className="bg-gradient-primary text-primary-foreground shadow-glow"
      >
        {saving ? "Saving…" : "Save changes"}
      </Button>
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
    toast.success(section === "registration" ? "Registration form saved" : "Scoring saved");
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
        Loading…
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
        {saving ? "Saving…" : "Save changes"}
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
        <h3 className="font-semibold">What participants see when they join</h3>
        <p className="text-xs text-muted-foreground mt-1">
          These fields show up on the registration screen at{" "}
          <span className="font-mono">/q/&lt;PIN&gt;</span> before participants enter the lobby.
          Name is always shown and required.
        </p>
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] items-center px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
          <span>Field</span>
          <span className="px-3">Visible</span>
          <span className="px-3">Required</span>
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
                      always on
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
      <p className="text-xs text-muted-foreground">
        For closed-roster sessions, required fields also act as identity checks.
      </p>
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
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold">How answers turn into a score</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Applied to every quiz session you create.
        </p>
      </div>

      <div>
        <Label className="mb-1.5">Marks per correct answer</Label>
        <Input
          type="number"
          min={1}
          max={100}
          value={value.marks_per_correct}
          onChange={(e) =>
            onChange({
              marks_per_correct: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
            })
          }
          className="w-32"
        />
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Speed bonus</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Extra points for correct answers given quickly.
            </p>
          </div>
          <Switch
            checked={value.speed_bonus_enabled}
            onCheckedChange={(v) => onChange({ speed_bonus_enabled: v })}
          />
        </div>
        {value.speed_bonus_enabled && (
          <div>
            <Label className="mb-1.5">Max bonus per session</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={value.speed_bonus_max}
              onChange={(e) =>
                onChange({
                  speed_bonus_max: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                })
              }
              className="w-32"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/40 p-4">
        <div>
          <div className="text-sm font-semibold">Show explanation after each question</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Participants see your stored explanation right after the timer expires.
          </p>
        </div>
        <Switch
          checked={value.show_explanation}
          onCheckedChange={(v) => onChange({ show_explanation: v })}
        />
      </div>
    </div>
  );
}
