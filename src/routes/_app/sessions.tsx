import { createFileRoute } from "@tanstack/react-router";
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
  generateAccessCode,
  type AttemptStats,
  type Category,
  type ParticipantLite,
  type QuestionLite,
  type Session,
  type SessionDraft,
  type SessionStatus,
  type TopThreeEntry,
} from "@/components/sessions/types";

export const Route = createFileRoute("/_app/sessions")({ component: SessionsPage });

function SessionsPage() {
  const { user } = useAuth();
  const { t } = useI18n();

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
    const { data, error } = await supabase
      .from("quiz_sessions")
      .select(
        `id, title, status, default_time_per_question, access_code, is_open, scheduled_at, created_at, category_id,
         question_categories ( name ),
         quiz_session_questions ( id, question_id ),
         quiz_session_participants ( participant_id ),
         quiz_attempts ( id, completed, score, total_questions, participant_name )`,
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSessions((data ?? []).map((row) => rowToSession(row as SessionRow)));
  }, [user]);

  useEffect(() => {
    void loadCategories();
    void loadQuestions();
    void loadParticipants();
    void loadSessions();
  }, [loadCategories, loadQuestions, loadParticipants, loadSessions]);

  const create = async (draft: SessionDraft) => {
    if (!user) return;
    const isScheduled = draft.saveMode === "schedule";
    const status: SessionStatus = "scheduled";
    const scheduled_at = isScheduled ? new Date(draft.scheduledAtLocal).toISOString() : null;
    const { data: inserted, error: insErr } = await supabase
      .from("quiz_sessions")
      .insert({
        owner_id: user.id,
        title: draft.title.trim(),
        category_id: draft.categoryId,
        mode: "qr_link",
        status,
        is_open: true,
        default_time_per_question: draft.timePerQuestionSec,
        access_code: generateAccessCode(),
        scheduled_at,
      })
      .select("id")
      .single();
    if (insErr || !inserted) {
      toast.error(insErr?.message ?? "Could not create session");
      throw insErr;
    }
    const sessionId = inserted.id;

    if (draft.questionIds.length > 0) {
      const rows = draft.questionIds.map((qid, i) => ({
        session_id: sessionId,
        question_id: qid,
        position: i,
        time_seconds: draft.timePerQuestionSec,
      }));
      const { error } = await supabase.from("quiz_session_questions").insert(rows);
      if (error) {
        toast.error(`Saved session but failed to add questions: ${error.message}`);
        throw error;
      }
    }

    if (draft.participantIds.length > 0) {
      const rows = draft.participantIds.map((pid) => ({
        session_id: sessionId,
        participant_id: pid,
      }));
      const { error } = await supabase.from("quiz_session_participants").insert(rows);
      if (error) {
        toast.error(`Saved session but failed to invite participants: ${error.message}`);
        throw error;
      }
    }

    toast.success(isScheduled ? "Session scheduled" : "Lobby is open");
    await loadSessions();
  };

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
        <SessionDialog
          title="Generate QR Session"
          description="Pick a category, choose questions and (optionally) participants, then save now or schedule for later."
          submitLabel="Save session"
          categories={categories}
          questions={questions}
          participants={participants}
          onSubmit={create}
          trigger={
            <Button
              className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
              disabled={!hasCategories}
              title={hasCategories ? "" : "Create a category first on the Questions page"}
            >
              <QrCode className="h-4 w-4" /> Generate QR Session
            </Button>
          }
        />
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
  question_categories: { name: string } | null;
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
    category_name: row.question_categories?.name ?? null,
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
