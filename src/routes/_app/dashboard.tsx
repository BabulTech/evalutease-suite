import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  HelpCircle,
  Users,
  PlayCircle,
  FileText,
  QrCode,
  Sparkles,
  ArrowRight,
  Activity,
  Zap,
  Star,
  Check,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/contexts/PlanContext";
import { LazyUpgradeModal } from "@/components/LazyUpgradeModal";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

type Stats = {
  sessions: number;
  active: number;
  participants: number;
  questions: number;
};

function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { plan, loading: planLoading } = usePlan();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeBannerDismissed, setUpgradeBannerDismissed] = useState(
    () => sessionStorage.getItem("upgrade_banner_dismissed") === "1"
  );

  // Only treat as free once the plan has actually loaded
  const isFreeTier = !planLoading && (!plan || plan.slug === "free");
  const isPaidTier = !planLoading && plan && plan.slug !== "free";
  const [stats, setStats] = useState<Stats>({
    sessions: 0,
    active: 0,
    participants: 0,
    questions: 0,
  });
  const [recent, setRecent] = useState<
    Array<{ id: string; title: string; status: string; created_at: string }>
  >([]);
  const [upcoming, setUpcoming] = useState<
    Array<{ id: string; title: string; scheduled_at: string }>
  >([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [sess, active, parts, qs, recentSessions, upcomingSessions] = await Promise.all([
        supabase
          .from("quiz_sessions")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id),
        supabase
          .from("quiz_sessions")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id)
          .eq("status", "active"),
        supabase
          .from("participants")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id),
        supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id),
        supabase
          .from("quiz_sessions")
          .select("id, title, status, created_at")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("quiz_sessions")
          .select("id, title, scheduled_at")
          .eq("owner_id", user.id)
          .eq("status", "scheduled")
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(5),
      ]);
      setStats({
        sessions: sess.count ?? 0,
        active: active.count ?? 0,
        participants: parts.count ?? 0,
        questions: qs.count ?? 0,
      });
      setRecent(recentSessions.data ?? []);
      setUpcoming(
        (upcomingSessions.data ?? []).map((s) => ({
          id: s.id,
          title: s.title,
          scheduled_at: s.scheduled_at as string,
        })),
      );
    })();
  }, [user]);

  const sessionLimit = plan?.limits.sessions_total ?? 20;
  const questionLimit = plan?.limits.question_bank ?? 100;
  const participantLimit = plan?.limits.participants_per_session ?? 30;
  const sessionLeft = sessionLimit === -1 ? null : Math.max(0, sessionLimit - stats.sessions);
  const questionLeft = questionLimit === -1 ? null : Math.max(0, questionLimit - stats.questions);
  const participantLeft = participantLimit === -1 ? null : Math.max(0, participantLimit - stats.participants);

  const cards = [
    {
      label: "Total Quiz",
      value: stats.sessions,
      icon: PlayCircle,
      color: "text-primary",
      to: "/quiz-history" as const,
      left: sessionLeft,
      limit: sessionLimit,
    },
    {
      label: "Active Sessions",
      value: stats.active,
      icon: Activity,
      color: "text-success",
      to: "/sessions" as const,
      left: null,
      limit: null,
    },
    {
      label: t("dash.participants"),
      value: stats.participants,
      icon: Users,
      color: "text-warning",
      to: "/participant-types" as const,
      left: participantLeft,
      limit: participantLimit,
    },
    {
      label: t("dash.questions"),
      value: stats.questions,
      icon: HelpCircle,
      color: "text-primary-glow",
      to: "/categories" as const,
      left: questionLeft,
      limit: questionLimit,
    },
  ];

  const actions = [
    { label: t("dash.generateQR"), to: "/sessions/new" as const, icon: QrCode },
    { label: "Manage Categories", to: "/categories" as const, icon: HelpCircle },
    { label: "Manage Participants", to: "/participant-types" as const, icon: Users },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{t("nav.dashboard")}</h1>
          <p className="text-muted-foreground mt-1">
            A clear view of your quizzes, sessions, and participants.
          </p>
        </div>
        {/* Plan badge — visible once plan has loaded */}
        {!planLoading && plan && (
          <div
            className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold cursor-pointer transition-all hover:shadow-glow ${
              plan.slug === "enterprise"
                ? "border-warning/40 bg-warning/10 text-warning"
                : plan.slug === "pro"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-muted/40 text-muted-foreground"
            }`}
            onClick={() => setUpgradeOpen(true)}
          >
            {plan.slug === "enterprise" ? (
              <Star className="h-4 w-4" />
            ) : plan.slug === "pro" ? (
              <Zap className="h-4 w-4" />
            ) : (
              <Zap className="h-4 w-4 opacity-50" />
            )}
            <span className="capitalize">{plan.name} Plan</span>
            {plan.slug === "free" && (
              <span className="text-xs font-normal text-muted-foreground ml-1">· Upgrade</span>
            )}
          </div>
        )}
      </div>

      {/* Upgrade banner — free tier only */}
      {isFreeTier && !upgradeBannerDismissed && (
        <div className="relative rounded-2xl overflow-hidden border border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-purple-500/10 p-5 flex items-center gap-5 shadow-glow">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
          <div className="relative rounded-2xl bg-gradient-primary p-3 shadow-glow shrink-0">
            <Zap className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="relative flex-1 min-w-0">
            <div className="font-display font-bold text-base">You're on the Free plan</div>
            <div className="text-sm text-muted-foreground mt-0.5">
              Unlock unlimited quizzes, AI features, and more participants by upgrading to Pro.
            </div>
          </div>
          <div className="relative flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setUpgradeOpen(true)}
              className="bg-gradient-primary text-primary-foreground shadow-glow gap-1.5 cursor-pointer"
            >
              <Star className="h-4 w-4" /> Upgrade to Pro
            </Button>
            <button
              type="button"
              onClick={() => { setUpgradeBannerDismissed(true); sessionStorage.setItem("upgrade_banner_dismissed", "1"); }}
              className="rounded-xl p-1.5 hover:bg-muted/40 transition-colors cursor-pointer text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Stat cards with glow */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const usedPct = c.limit && c.limit !== -1 ? Math.min(100, Math.round((c.value / c.limit) * 100)) : 0;
          const danger = usedPct >= 80 && c.limit !== null && c.limit !== -1;
          return (
            <Link
              key={c.label}
              to={c.to}
              className="group rounded-2xl border border-border bg-card/60 backdrop-blur p-5 shadow-card hover:border-primary/50 hover:shadow-glow hover:bg-card/90 transition-all duration-300 hover:scale-[1.02]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-primary/80 transition-colors">
                  {c.label}
                </span>
                <c.icon className={`h-4 w-4 ${c.color} group-hover:scale-110 transition-transform`} />
              </div>
              <div className="mt-3 font-display text-3xl font-bold group-hover:text-primary transition-colors">{c.value}</div>
              {c.left !== null && c.limit !== null && (
                <div className="mt-2 space-y-1">
                  <div className={`text-[10px] font-medium ${danger ? "text-destructive" : "text-muted-foreground"}`}>
                    {c.limit === -1 ? "Unlimited" : `${c.left} left of ${c.limit}`}
                  </div>
                  {c.limit !== -1 && (
                    <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${danger ? "bg-destructive" : "bg-primary/60"}`}
                        style={{ width: `${usedPct}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Quick actions with glow */}
      <div>
        <h2 className="font-display text-lg font-semibold mb-3">{t("dash.quickActions")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {actions.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className="group rounded-2xl border border-border bg-card/40 hover:bg-card hover:border-primary/50 hover:shadow-glow p-4 transition-all duration-300 hover:scale-[1.02]"
            >
              <a.icon className="h-5 w-5 text-primary mb-3 group-hover:scale-110 transition-transform" />
              <div className="text-sm font-semibold leading-snug">{a.label}</div>
              <ArrowRight className="h-4 w-4 mt-2 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>
      </div>

      {/* Pro pitch card — free tier only */}
      {isFreeTier && (
        <div className="rounded-2xl border border-primary/30 bg-card/60 p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Star className="h-5 w-5 text-primary" />
            <span className="font-display font-bold text-lg">Go Pro and unlock everything</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: "🚀", title: "Unlimited Quizzes", desc: "Create as many quiz sessions as you need, every day." },
              { icon: "🤖", title: "AI Question Builder", desc: "Auto-generate questions with AI in seconds." },
              { icon: "👥", title: "500+ Participants", desc: "Host large groups without hitting a cap." },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-muted/20 p-4 space-y-1.5">
                <div className="text-2xl">{f.icon}</div>
                <div className="font-semibold text-sm">{f.title}</div>
                <div className="text-xs text-muted-foreground">{f.desc}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button
              onClick={() => setUpgradeOpen(true)}
              className="bg-gradient-primary text-primary-foreground shadow-glow gap-2 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" /> See Plans &amp; Pricing
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-success" /> Cancel anytime
              <span className="mx-1">·</span>
              <Check className="h-3.5 w-3.5 text-success" /> No hidden fees
            </div>
          </div>
        </div>
      )}

      {/* Recent & Upcoming with glow */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="group rounded-2xl border border-border bg-card/60 p-5 hover:border-primary/30 hover:shadow-glow transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{t("dash.recentSessions")}</h3>
            <Link to="/sessions" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-2">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link
                    to="/sessions"
                    search={r.status === "active" || r.status === "scheduled" ? { lobby: r.id } : {}}
                    className="flex items-center justify-between rounded-xl bg-secondary/40 hover:bg-secondary/70 hover:shadow-glow px-3 py-2.5 transition-all duration-200"
                  >
                    <div>
                      <div className="text-sm font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary capitalize">
                      {r.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="group rounded-2xl border border-border bg-card/60 p-5 hover:border-primary/30 hover:shadow-glow transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{t("dash.upcoming")}</h3>
            <Button size="sm" variant="ghost" className="text-primary text-xs" asChild>
              <Link to="/sessions/new">+ Schedule</Link>
            </Button>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((u) => (
                <li key={u.id}>
                  <Link
                    to="/sessions"
                    search={{ lobby: u.id }}
                    className="flex items-center justify-between rounded-xl bg-secondary/40 hover:bg-secondary/70 hover:shadow-glow px-3 py-2.5 transition-all duration-200"
                  >
                    <div>
                      <div className="text-sm font-medium">{u.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(u.scheduled_at).toLocaleString()}
                      </div>
                    </div>
                    <Sparkles className="h-4 w-4 text-primary" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <LazyUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} targetSlug="pro" />
    </div>
  );
}

function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="text-center py-8">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
        <FileText className="h-5 w-5 text-primary" />
      </div>
      <p className="text-sm text-muted-foreground">{t("dash.empty")}</p>
    </div>
  );
}
