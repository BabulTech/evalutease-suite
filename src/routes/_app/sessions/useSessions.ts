import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import type {
  AttemptStats,
  Session,
  SessionStatus,
  TopThreeEntry,
} from "@/components/sessions/types";

const SESSION_PAGE_SIZE = 5;

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
          submittedRows.reduce(
            (acc, a) => acc + (a.score / Math.max(1, a.total_questions)) * 100,
            0,
          ) / submittedRows.length,
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

export function useSessions(onIndex: boolean) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(SESSION_PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
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
      .order("created_at", { ascending: false })
      .range(0, visibleLimit);
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    const all = (data ?? []) as Omit<SessionRow, "subcat_name" | "cat_name">[];
    setHasMore(all.length > visibleLimit);
    const rows = all.slice(0, visibleLimit);
    const subIds = Array.from(
      new Set(rows.flatMap((r) => (r.subcategory_id ? [r.subcategory_id] : []))),
    );
    const catIds = Array.from(new Set(rows.flatMap((r) => (r.category_id ? [r.category_id] : []))));

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
          row.subcategory_id ? (subNames.get(row.subcategory_id) ?? null) : null,
          row.category_id ? (catNames.get(row.category_id) ?? null) : null,
        ),
      ),
    );
  }, [user, visibleLimit]);

  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-event-handler
    if (onIndex) void loadSessions();
  }, [loadSessions, onIndex]);

  const remove = async (id: string, deleteActiveMsg: string, deletedMsg: string) => {
    const target = sessions.find((s) => s.id === id);
    if (target?.status === "active") {
      toast.error(deleteActiveMsg);
      return;
    }
    const { error } = await supabase
      .from("quiz_sessions")
      .delete()
      .eq("id", id)
      .neq("status", "active");
    if (error) {
      toast.error(error.message);
      return;
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast.success(deletedMsg);
  };

  const activeSessions = useMemo(() => sessions.filter((s) => s.status === "active"), [sessions]);
  const scheduledSessions = useMemo(
    () => sessions.filter((s) => s.status === "scheduled"),
    [sessions],
  );

  return {
    sessions,
    loading,
    hasMore,
    activeSessions,
    scheduledSessions,
    loadMore: () => setVisibleLimit((v) => v + SESSION_PAGE_SIZE),
    remove,
  };
}
