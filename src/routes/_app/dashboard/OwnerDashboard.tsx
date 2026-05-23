import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  ChevronRight,
  Coins,
  FileText,
  HelpCircle,
  PlayCircle,
  Plus,
  Star,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { DashboardActivityCard } from "@/components/dashboard/DashboardActivityCard";
import type { PlanInfo } from "@/contexts/PlanContext";
import type { Stats, RecentSession } from "./types";
import { STATUS_STYLES } from "./types";
import { LimitBar } from "./LimitBar";

type Props = {
  plan: PlanInfo | null;
  planLoading: boolean;
  stats: Stats;
  recent: RecentSession[];
  credits: { balance: number; total_earned: number; total_spent: number } | null;
  firstName: string;
  greeting: string;
};

export function OwnerDashboard({
  plan,
  planLoading,
  stats,
  recent,
  credits,
  firstName,
  greeting,
}: Props) {
  const { t } = useI18n();
  const [upgradeBannerDismissed, setUpgradeBannerDismissed] = useState(
    () => sessionStorage.getItem("upgrade_banner_dismissed") === "1",
  );

  const questionLimit = plan?.question_bank ?? 100;
  const participantLimit = plan?.participants_per_session ?? 30;
  const FREE_SLUGS = ["individual_starter", "enterprise_starter", "enterprise_free"];
  const isFreeTier = !planLoading && (!plan || plan.slug === "individual_starter");
  const showCredits = !planLoading && plan && !FREE_SLUGS.includes(plan.slug);

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{greeting},</p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight truncate">
            {firstName} 👋
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {!planLoading && plan && (
              <Link
                to="/settings"
                search={{ tab: "plan" }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all hover:shadow-glow ${
                  plan.tier === "enterprise"
                    ? "border-warning/40 bg-warning/10 text-warning"
                    : plan.slug !== "individual_starter"
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-muted/40 text-muted-foreground"
                }`}
              >
                <Star className="size-3" />
                {plan.name}
              </Link>
            )}
            {showCredits && (
              <Link
                to="/billing"
                search={{ plan: "" }}
                className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/5 px-3 py-1 text-xs font-semibold text-warning hover:bg-warning/10 transition-all"
              >
                <Coins className="size-3" />
                {credits?.balance ?? 0} credits
              </Link>
            )}
          </div>
        </div>
        <Link to="/sessions/new" className="w-full sm:w-auto shrink-0">
          <Button className="h-12 w-full sm:w-auto px-6 bg-gradient-primary shadow-glow font-semibold text-base gap-2 hover:opacity-90 transition-opacity">
            <Plus size={18} /> Start New Session
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-2 sm:gap-3">
        <Link
          to="/sessions"
          className="group rounded-xl md:rounded-2xl border border-success/20 bg-success/5 hover:border-success/50 hover:shadow-glow p-3 sm:p-4 transition-all min-h-[92px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Active
            </span>
            <Activity className="size-4 text-success group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-success">{stats.active}</div>
          <div className="text-[10px] text-muted-foreground mt-1">live sessions</div>
        </Link>

        <Link
          to="/categories"
          className="group rounded-xl md:rounded-2xl border border-border bg-card/60 hover:border-primary/50 hover:shadow-glow p-3 sm:p-4 transition-all min-h-[92px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Questions
            </span>
            <HelpCircle className="size-4 text-primary group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold">{stats.questions}</div>
          <LimitBar used={stats.questions} limit={questionLimit} />
        </Link>

        <Link
          to="/participant-types"
          className="group rounded-xl md:rounded-2xl border border-border bg-card/60 hover:border-primary/50 hover:shadow-glow p-3 sm:p-4 transition-all min-h-[92px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Participants
            </span>
            <Users className="size-4 text-warning group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold">{stats.participants}</div>
          <LimitBar used={stats.participants} limit={participantLimit} />
        </Link>
      </div>

      <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">{t("dash.recentSessions")}</h2>
          <Link
            to="/quiz-history"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            {t("dash.viewAll")} <ChevronRight size={12} />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <div className="mx-auto size-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <PlayCircle className="size-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">No sessions yet</p>
            <Link to="/sessions/new">
              <Button size="sm" className="bg-gradient-primary shadow-glow gap-1.5">
                <Plus size={14} /> Create your first session
              </Button>
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  to="/sessions"
                  search={r.status === "active" || r.status === "scheduled" ? { lobby: r.id } : {}}
                  className="flex items-start sm:items-center justify-between rounded-xl bg-secondary/40 hover:bg-secondary/70 p-3 transition-all min-h-[56px] gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 shrink-0">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[r.status] ?? STATUS_STYLES.draft}`}
                    >
                      {r.status}
                    </span>
                    {r.status === "active" && (
                      <span className="text-xs font-semibold text-success">Resume →</span>
                    )}
                    {r.status === "completed" && (
                      <span className="text-xs font-semibold text-primary">Results →</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DashboardActivityCard limit={20} />

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
          Quick Access
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {[
            {
              label: "Categories",
              desc: "Manage questions",
              to: "/categories" as const,
              icon: HelpCircle,
              color: "text-primary",
            },
            {
              label: "Participants",
              desc: "Manage groups",
              to: "/participant-types" as const,
              icon: Users,
              color: "text-warning",
            },
            {
              label: "Reports",
              desc: "View analytics",
              to: "/reports" as const,
              icon: BarChart3,
              color: "text-success",
            },
            {
              label: "All Sessions",
              desc: "Session history",
              to: "/quiz-history" as const,
              icon: FileText,
              color: "text-muted-foreground",
            },
          ].map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className="group rounded-xl md:rounded-2xl border border-border bg-card/40 hover:bg-card hover:border-primary/50 hover:shadow-glow p-3 sm:p-4 min-h-[86px] transition-all duration-200 flex flex-col justify-between"
            >
              <a.icon className={`size-5 ${a.color} group-hover:scale-110 transition-transform`} />
              <div>
                <div className="text-sm font-semibold leading-snug">{a.label}</div>
                <div className="text-[11px] text-muted-foreground">{a.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {isFreeTier && !upgradeBannerDismissed && (
        <div className="relative rounded-xl md:rounded-2xl overflow-hidden border border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-purple-500/10 p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4 shadow-glow">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
          <div className="relative rounded-2xl bg-gradient-primary p-3 shadow-glow shrink-0">
            <Zap className="size-5 text-primary-foreground" />
          </div>
          <div className="relative flex-1 min-w-0">
            <div className="font-display font-bold text-base">{t("dash.freePlanBanner")}</div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {t("dash.freePlanBannerDesc")}
            </div>
          </div>
          <div className="relative flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <Link to="/settings" search={{ tab: "plan" }} className="flex-1 sm:flex-none">
              <Button
                data-upgrade="true"
                className="h-10 w-full sm:w-auto bg-gradient-primary text-primary-foreground shadow-glow gap-1.5"
              >
                <Star className="size-4" /> {t("dash.upgradeToPro")}
              </Button>
            </Link>
            <button
              type="button"
              title="Dismiss"
              onClick={() => {
                setUpgradeBannerDismissed(true);
                sessionStorage.setItem("upgrade_banner_dismissed", "1");
              }}
              className="size-10 flex items-center justify-center rounded-xl hover:bg-muted/40 transition-colors text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
