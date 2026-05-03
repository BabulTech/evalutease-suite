import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  HelpCircle,
  Users,
  PlayCircle,
  FileText,
  Plus,
  QrCode,
  Sparkles,
  ArrowRight,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

type Stats = { quizzes: number; sessions: number; participants: number; questions: number };

function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats>({
    quizzes: 0,
    sessions: 0,
    participants: 0,
    questions: 0,
  });
  const [recent, setRecent] = useState<
    Array<{ id: string; title: string; status: string; created_at: string }>
  >([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [q, s, p, qs, recentSessions] = await Promise.all([
        supabase
          .from("quiz_sessions")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", user.id),
        supabase.from("quiz_attempts").select("id", { count: "exact", head: true }),
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
      ]);
      setStats({
        quizzes: q.count ?? 0,
        sessions: s.count ?? 0,
        participants: p.count ?? 0,
        questions: qs.count ?? 0,
      });
      setRecent(recentSessions.data ?? []);
    })();
  }, [user]);

  const cards = [
    { label: t("dash.quizzes"), value: stats.quizzes, icon: PlayCircle, color: "text-primary" },
    { label: t("dash.sessions"), value: stats.sessions, icon: Sparkles, color: "text-success" },
    {
      label: t("dash.participants"),
      value: stats.participants,
      icon: Users,
      color: "text-warning",
    },
    {
      label: t("dash.questions"),
      value: stats.questions,
      icon: HelpCircle,
      color: "text-primary-glow",
    },
  ];

  const actions = [
    { label: t("dash.createQuiz"), to: "/sessions/new", icon: Plus },
    { label: t("dash.createQuestions"), to: "/categories", icon: HelpCircle },
    { label: "Add Participant", to: "/participant-types", icon: UserPlus },
    { label: t("dash.manageParticipants"), to: "/participant-types", icon: Users },
    { label: t("dash.generateQR"), to: "/sessions/new", icon: QrCode },
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
          <div
            key={c.label}
            className="rounded-2xl border border-border bg-card/60 backdrop-blur p-5 shadow-card hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {c.label}
              </span>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <div className="mt-3 font-display text-3xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-display text-lg font-semibold mb-3">{t("dash.quickActions")}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2.5"
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
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card/60 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">{t("dash.upcoming")}</h3>
            <Button size="sm" variant="ghost" className="text-primary text-xs" asChild>
              <Link to="/sessions">+ Schedule</Link>
            </Button>
          </div>
          <EmptyState />
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
