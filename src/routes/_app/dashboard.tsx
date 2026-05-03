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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

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

  // Each card is a link to the relevant management page.
  const cards = [
    {
      label: "Total Sessions",
      value: stats.sessions,
      icon: PlayCircle,
      color: "text-primary",
      to: "/sessions" as const,
    },
    {
      label: "Active Sessions",
      value: stats.active,
      icon: Activity,
      color: "text-success",
      to: "/sessions" as const,
    },
    {
      label: t("dash.participants"),
      value: stats.participants,
      icon: Users,
      color: "text-warning",
      to: "/participant-types" as const,
    },
    {
      label: t("dash.questions"),
      value: stats.questions,
      icon: HelpCircle,
      color: "text-primary-glow",
      to: "/categories" as const,
    },
  ];

  const actions = [
    { label: t("dash.generateQR"), to: "/sessions/new" as const, icon: QrCode },
    { label: "Manage Categories", to: "/categories" as const, icon: HelpCircle },
    { label: "Manage Participants", to: "/participant-types" as const, icon: Users },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{t("nav.dashboard")}</h1>
        <p className="text-muted-foreground mt-1">
          A clear view of your quizzes, sessions, and participants.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="rounded-2xl border border-border bg-card/60 backdrop-blur p-5 shadow-card hover:border-primary/40 hover:shadow-glow transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {c.label}
              </span>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <div className="mt-3 font-display text-3xl font-bold">{c.value}</div>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold mb-3">{t("dash.quickActions")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {actions.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className="group rounded-2xl border border-border bg-card/40 hover:bg-card hover:border-primary/40 p-4 transition-all"
            >
              <a.icon className="h-5 w-5 text-primary mb-3" />
              <div className="text-sm font-semibold leading-snug">{a.label}</div>
              <ArrowRight className="h-4 w-4 mt-2 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card/60 p-5">
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
                    className="flex items-center justify-between rounded-xl bg-secondary/40 hover:bg-secondary/70 px-3 py-2.5 transition-colors"
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
        <div className="rounded-2xl border border-border bg-card/60 p-5">
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
                    className="flex items-center justify-between rounded-xl bg-secondary/40 hover:bg-secondary/70 px-3 py-2.5 transition-colors"
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
