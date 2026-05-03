import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PlayCircle, QrCode } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SessionCard } from "@/components/sessions/SessionCard";
import {
  type AttemptStats,
  type Session,
  type SessionStatus,
  type TopThreeEntry,
} from "@/components/sessions/types";

export const Route = createFileRoute("/_app/sessions")({
  component: SessionsPage,
});

function SessionsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onIndex = pathname === "/sessions" || pathname === "/sessions/";

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Active + scheduled + draft + expired sessions live here.
    // Completed sessions move to Quiz History.
    const { data, error } = await supabase
      .from("quiz_sessions")
      .select(
        `id, title, status, default_time_per_question, access_code, is_open, scheduled_at, created_at, category_id, subcategory_id,
         quiz_session_questions ( id, question_id ),
         quiz_session_participants ( participant_id ),
         quiz_attempts ( id, completed, score, total_questions, participant_name )`,
      )
      .eq("owner_id", user.id)
      .neq("status", "completed")
      .order("created_at", { ascending: false });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    const rows = (data ?? []) as Omit<SessionRow, "subcat_name" | "cat_name">[];
    const subIds = Array.from(
      new Set(rows.map((r) => r.subcategory_id).filter((v): v is string => !!v)),
    );
    const catIds = Array.from(
      new Set(rows.map((r) => r.category_id).filter((v): v is string => !!v)),
    );

    const [subRes, catRes] = await Promise.all([
      subIds.length > 0
        ? supabase.from("question_subcategories").select("id, name").in("id", subIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
      catIds.length > 0
        ? supabase.from("question_categories").select("id, name").in("id", catIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    ]);
    setLoading(false);
    if (subRes.error) toast.error(subRes.error.message);
    if (catRes.error) toast.error(catRes.error.message);

    const subNames = new Map<string, string>();
    for (const s of subRes.data ?? []) subNames.set(s.id, s.name);
    const catNames = new Map<string, string>();
    for (const c of catRes.data ?? []) catNames.set(c.id, c.name);

    setSessions(
      rows.map((row) =>
        rowToSession(
          row,
          row.subcategory_id ? subNames.get(row.subcategory_id) ?? null : null,
          row.category_id ? catNames.get(row.category_id) ?? null : null,
        ),
      ),
    );
  }, [user]);

  useEffect(() => {
    if (onIndex) void loadSessions();
  }, [loadSessions, onIndex]);

  if (!onIndex) return <Outlet />;

  const remove = async (id: string) => {
    const { error } = await supabase.from("quiz_sessions").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast.success("Session deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{t("nav.sessions")}</h1>
          <p className="text-muted-foreground mt-1">
            Generate QR/link sessions, schedule them, and run live quizzes for your participants.
          </p>
        </div>
        <Button
          asChild
          className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
        >
          <Link to="/sessions/new">
            <QrCode className="h-4 w-4" /> Generate QR Session
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Loading sessions…
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
          <PlayCircle className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">No sessions yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Hit Generate QR Session to create your first one.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  );
}

type SessionRow = {
  id: string;
  title: string;
  status: SessionStatus;
  default_time_per_question: number | null;
  access_code: string | null;
  is_open: boolean;
  scheduled_at: string | null;
  created_at: string;
  category_id: string | null;
  subcategory_id: string | null;
  quiz_session_questions: { id: string; question_id: string }[] | null;
  quiz_session_participants: { participant_id: string }[] | null;
  quiz_attempts:
    | {
        id: string;
        completed: boolean;
        score: number;
        total_questions: number;
        participant_name: string | null;
      }[]
    | null;
};

function rowToSession(
  row: SessionRow,
  subcategoryName: string | null,
  categoryName: string | null,
): Session {
  const attempts = row.quiz_attempts ?? [];
  const submittedRows = attempts.filter((a) => a.completed);
  const avgPercent =
    submittedRows.length === 0
      ? 0
      : Math.round(
          submittedRows.reduce((acc, a) => {
            const total = a.total_questions || 1;
            return acc + (a.score / total) * 100;
          }, 0) / submittedRows.length,
        );
  const topThree: TopThreeEntry[] = submittedRows
    .slice()
    .sort(
      (a, b) => b.score / Math.max(1, b.total_questions) - a.score / Math.max(1, a.total_questions),
    )
    .slice(0, 3)
    .map((a) => ({
      name: a.participant_name ?? "Anonymous",
      score: a.score,
      total: a.total_questions || 1,
    }));
  const stats: AttemptStats = {
    joined: attempts.length,
    waiting: attempts.length - submittedRows.length,
    submitted: submittedRows.length,
    avgPercent,
    topThree,
  };

  return {
    id: row.id,
    title: row.title,
    category_id: row.category_id,
    category_name: subcategoryName ?? categoryName ?? null,
    status: row.status,
    default_time_per_question: row.default_time_per_question ?? 60,
    access_code: row.access_code,
    is_open: row.is_open,
    scheduled_at: row.scheduled_at,
    created_at: row.created_at,
    question_count: row.quiz_session_questions?.length ?? 0,
    participant_count: row.quiz_session_participants?.length ?? 0,
    attempts: stats,
  };
}
