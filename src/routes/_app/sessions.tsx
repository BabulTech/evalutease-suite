import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PlayCircle, QrCode } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SessionDialog } from "@/components/sessions/SessionDialog";
import { SessionCard, EditTriggerButton } from "@/components/sessions/SessionCard";
import { LobbyDialog } from "@/components/sessions/LobbyDialog";
import {
  type AttemptStats,
  type Category,
  type ParticipantLite,
  type QuestionLite,
  type Session,
  type SessionDraft,
  type SessionStatus,
  type TopThreeEntry,
} from "@/components/sessions/types";

type SessionsSearch = { lobby?: string };

export const Route = createFileRoute("/_app/sessions")({
  validateSearch: (s: Record<string, unknown>): SessionsSearch => ({
    lobby: typeof s.lobby === "string" ? s.lobby : undefined,
  }),
  component: SessionsPage,
});

function SessionsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onIndex = pathname === "/sessions" || pathname === "/sessions/";

  const [sessions, setSessions] = useState<Session[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<QuestionLite[]>([]);
  const [participants, setParticipants] = useState<ParticipantLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [openLobby, setOpenLobby] = useState<Session | null>(null);

  const loadCategories = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("question_categories")
      .select("id, name")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    setCategories(data ?? []);
  }, [user]);

  const loadQuestions = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("questions")
      .select("id, text, category_id, difficulty")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setQuestions((data ?? []) as QuestionLite[]);
  }, [user]);

  const loadParticipants = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("participants")
      .select("id, name, email, mobile")
      .eq("owner_id", user.id)
      .order("name", { ascending: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    setParticipants((data ?? []) as ParticipantLite[]);
  }, [user]);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Fetch session rows + the per-session children (questions/participants/attempts) but
    // resolve the category / subcategory NAME with separate queries. This avoids relying on
    // PostgREST's schema-cache for FK joins, which lags after migrations.
    const { data, error } = await supabase
      .from("quiz_sessions")
      .select(
        `id, title, status, default_time_per_question, access_code, is_open, scheduled_at, created_at, category_id, subcategory_id,
         quiz_session_questions ( id, question_id ),
         quiz_session_participants ( participant_id ),
         quiz_attempts ( id, completed, score, total_questions, participant_name )`,
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    const rows = (data ?? []) as Omit<SessionRow, "question_categories" | "question_subcategories">[];
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
        rowToSession({
          ...row,
          question_subcategories: row.subcategory_id
            ? { name: subNames.get(row.subcategory_id) ?? "" }
            : null,
          question_categories: row.category_id
            ? { name: catNames.get(row.category_id) ?? "" }
            : null,
        } as SessionRow),
      ),
    );
  }, [user]);

  useEffect(() => {
    if (!onIndex) return;
    void loadCategories();
    void loadQuestions();
    void loadParticipants();
    void loadSessions();
  }, [loadCategories, loadQuestions, loadParticipants, loadSessions, onIndex]);

  // Auto-open the lobby for a session ?lobby=<id> redirected from /sessions/new
  useEffect(() => {
    if (!onIndex) return;
    if (!search.lobby) return;
    const target = sessions.find((s) => s.id === search.lobby);
    if (target) {
      setOpenLobby(target);
      void navigate({ to: "/sessions", search: {}, replace: true });
    }
  }, [search.lobby, sessions, navigate, onIndex]);

  if (!onIndex) return <Outlet />;

  const edit = async (id: string, draft: SessionDraft, original: Session) => {
    if (!user) return;
    const isScheduled = draft.saveMode === "schedule";
    const scheduled_at = isScheduled ? new Date(draft.scheduledAtLocal).toISOString() : null;
    const { error: updErr } = await supabase
      .from("quiz_sessions")
      .update({
        title: draft.title.trim(),
        category_id: draft.categoryId,
        default_time_per_question: draft.timePerQuestionSec,
        scheduled_at,
        status: original.status === "active" ? "active" : "scheduled",
      })
      .eq("id", id);
    if (updErr) {
      toast.error(updErr.message);
      throw updErr;
    }
    const { error: delQErr } = await supabase
      .from("quiz_session_questions")
      .delete()
      .eq("session_id", id);
    if (delQErr) {
      toast.error(delQErr.message);
      throw delQErr;
    }
    if (draft.questionIds.length > 0) {
      const rows = draft.questionIds.map((qid, i) => ({
        session_id: id,
        question_id: qid,
        position: i,
        time_seconds: draft.timePerQuestionSec,
      }));
      const { error } = await supabase.from("quiz_session_questions").insert(rows);
      if (error) {
        toast.error(error.message);
        throw error;
      }
    }
    const { error: delPErr } = await supabase
      .from("quiz_session_participants")
      .delete()
      .eq("session_id", id);
    if (delPErr) {
      toast.error(delPErr.message);
      throw delPErr;
    }
    if (draft.participantIds.length > 0) {
      const rows = draft.participantIds.map((pid) => ({
        session_id: id,
        participant_id: pid,
      }));
      const { error } = await supabase.from("quiz_session_participants").insert(rows);
      if (error) {
        toast.error(error.message);
        throw error;
      }
    }
    toast.success("Session updated");
    await loadSessions();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("quiz_sessions").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast.success("Session deleted");
  };

  const start = async (id: string) => {
    const startedAt = new Date().toISOString();
    const { error } = await supabase
      .from("quiz_sessions")
      .update({ status: "active", started_at: startedAt })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, status: "active" } : s)));
    toast.success("Quiz started — participants will see questions");
  };

  const draftFromSession = async (s: Session): Promise<SessionDraft> => {
    if (!user) {
      return makeDraft(s, [], []);
    }
    const [{ data: qRows }, { data: pRows }] = await Promise.all([
      supabase.from("quiz_session_questions").select("question_id").eq("session_id", s.id),
      supabase.from("quiz_session_participants").select("participant_id").eq("session_id", s.id),
    ]);
    return makeDraft(
      s,
      (qRows ?? []).map((r) => r.question_id),
      (pRows ?? []).map((r) => r.participant_id),
    );
  };

  const hasCategories = categories.length > 0;

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
            {hasCategories
              ? "Hit Generate QR Session to create your first one."
              : "Create at least one question category first, then come back here."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onStart={start}
              onOpenLobby={setOpenLobby}
              onDelete={remove}
              editTrigger={
                <EditSessionDialogTrigger
                  session={s}
                  categories={categories}
                  questions={questions}
                  participants={participants}
                  loadDraft={draftFromSession}
                  onSubmit={(d) => edit(s.id, d, s)}
                />
              }
            />
          ))}
        </div>
      )}

      {openLobby && (
        <LobbyDialog
          session={openLobby}
          open={!!openLobby}
          onOpenChange={(o) => !o && setOpenLobby(null)}
          onStart={async (id) => {
            await start(id);
            setOpenLobby((curr) => (curr ? { ...curr, status: "active" } : curr));
          }}
        />
      )}
    </div>
  );
}

function EditSessionDialogTrigger({
  session,
  categories,
  questions,
  participants,
  loadDraft,
  onSubmit,
}: {
  session: Session;
  categories: Category[];
  questions: QuestionLite[];
  participants: ParticipantLite[];
  loadDraft: (s: Session) => Promise<SessionDraft>;
  onSubmit: (draft: SessionDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);

  const ensureDraft = useCallback(async () => {
    if (draft || loading) return;
    setLoading(true);
    try {
      const d = await loadDraft(session);
      setDraft(d);
    } finally {
      setLoading(false);
    }
  }, [draft, loading, loadDraft, session]);

  return (
    <span onMouseEnter={() => void ensureDraft()} onClick={() => void ensureDraft()}>
      {draft ? (
        <SessionDialog
          title="Edit session"
          submitLabel="Save changes"
          categories={categories}
          questions={questions}
          participants={participants}
          initial={draft}
          onSubmit={async (d) => {
            setPending(true);
            try {
              await onSubmit(d);
            } finally {
              setPending(false);
            }
          }}
          trigger={<EditTriggerButton />}
        />
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={loading || pending}
          onClick={() => void ensureDraft()}
        >
          {loading ? "Loading…" : "Edit Quiz"}
        </Button>
      )}
    </span>
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
  question_categories: { name: string } | null;
  question_subcategories: { name: string } | null;
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

function rowToSession(row: SessionRow): Session {
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
    category_name:
      row.question_subcategories?.name ?? row.question_categories?.name ?? null,
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

function makeDraft(s: Session, questionIds: string[], participantIds: string[]): SessionDraft {
  return {
    title: s.title,
    categoryId: s.category_id,
    timePerQuestionSec: s.default_time_per_question,
    questionIds,
    participantIds,
    saveMode: s.scheduled_at ? "schedule" : "now",
    scheduledAtLocal: s.scheduled_at ? toLocalDateTimeInput(new Date(s.scheduled_at)) : "",
  };
}

function toLocalDateTimeInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
