import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getQuizReportRows } from "@/lib/quiz-reports";
import { paginate } from "@/lib/pagination";
import type { User } from "@supabase/supabase-js";
import { HISTORY_PAGE_SIZE } from "./types";
import type { SessionRow, AttemptRow, SessionWithStats, ProfileRow } from "./types";
import { buildHistoryTrends, toReportAttempt } from "./helpers";

export function useQuizHistory(user: User | null) {
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [filterTitle, setFilterTitle] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [attemptPages, setAttemptPages] = useState<Record<string, number>>({});
  const [expandedAttempts, setExpandedAttempts] = useState<Record<string, AttemptRow[]>>({});
  const [expandingIds, setExpandingIds] = useState<Set<string>>(new Set());
  const [attemptAnswerStats, setAttemptAnswerStats] = useState<
    Record<string, Record<string, { correct: number; wrong: number; attempted: number }>>
  >({});
  const [sessionMaxPts, setSessionMaxPts] = useState<Record<string, number>>({});
  const [downloadOpenId, setDownloadOpenId] = useState<string | null>(null);
  const downloadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setDownloadOpenId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const offset = page * HISTORY_PAGE_SIZE;
    let sessionQuery = supabase
      .from("quiz_sessions")
      .select(
        "id, title, status, created_at, category_id, subcategory_id, default_time_per_question, subject, topic, description",
        { count: "exact" },
      )
      .eq("owner_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .range(offset, offset + HISTORY_PAGE_SIZE - 1);
    if (filterTitle.trim()) sessionQuery = sessionQuery.ilike("title", `%${filterTitle.trim()}%`);
    if (filterType) sessionQuery = sessionQuery.eq("topic", filterType);
    if (filterDateFrom) sessionQuery = sessionQuery.gte("created_at", `${filterDateFrom}T00:00:00`);
    if (filterDateTo) sessionQuery = sessionQuery.lte("created_at", `${filterDateTo}T23:59:59`);

    const { data: ss, error, count } = await sessionQuery;
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    const rows = (ss ?? []) as SessionRow[];
    setSessionTotal(count ?? 0);
    if (rows.length === 0) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const sessionIds = rows.map((r) => r.id);
    const subIds = Array.from(
      new Set(rows.flatMap((r) => (r.subcategory_id ? [r.subcategory_id] : []))),
    );
    const catIds = Array.from(new Set(rows.flatMap((r) => (r.category_id ? [r.category_id] : []))));

    const [attemptsRes, subRes, catRes, profileRes, maxPtsRes] = await Promise.all([
      supabase
        .from("quiz_attempts")
        .select(
          "id, session_id, participant_id, participant_name, participant_email, score, total_questions, completed, completed_at",
        )
        .in("session_id", sessionIds)
        .order("score", { ascending: false }),
      subIds.length > 0
        ? supabase.from("question_subcategories").select("id, name").in("id", subIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
      catIds.length > 0
        ? supabase.from("question_categories").select("id, name").in("id", catIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
      supabase
        .from("profiles")
        .select("full_name, first_name, last_name, organization")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("quiz_session_questions")
        .select("session_id, questions(max_points)")
        .in("session_id", sessionIds),
    ]);
    if (attemptsRes.error) toast.error(attemptsRes.error.message);

    const attemptIds = (attemptsRes.data ?? []).map((a) => a.id);
    const liveScores: Record<string, number> = {};
    if (attemptIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- quiz_answers table not yet in generated Supabase types
      const { data: ansData } = await (supabase as any)
        .from("quiz_answers")
        .select("attempt_id, points_awarded")
        .in("attempt_id", attemptIds);
      for (const r of (ansData ?? []) as { attempt_id: string; points_awarded: number | null }[]) {
        liveScores[r.attempt_id] = (liveScores[r.attempt_id] ?? 0) + (r.points_awarded ?? 0);
      }
    }
    if (attemptsRes.data) {
      for (const a of attemptsRes.data as AttemptRow[]) {
        if (liveScores[a.id] !== undefined) a.score = liveScores[a.id];
      }
    }

    setLoading(false);
    const newSessionMaxPts: Record<string, number> = {};
    for (const r of maxPtsRes.data ?? []) {
      const sid = r.session_id as string;
      newSessionMaxPts[sid] =
        (newSessionMaxPts[sid] ?? 0) +
        ((r.questions as { max_points?: number } | null)?.max_points ?? 1);
    }
    setSessionMaxPts(newSessionMaxPts);
    if (profileRes.data) setProfile(profileRes.data as ProfileRow);

    const subNames = new Map<string, string>();
    for (const s of subRes.data ?? []) subNames.set(s.id, s.name);
    const catNames = new Map<string, string>();
    for (const c of catRes.data ?? []) catNames.set(c.id, c.name);

    const attemptsBySession = new Map<string, AttemptRow[]>();
    for (const a of (attemptsRes.data ?? []) as AttemptRow[]) {
      const arr = attemptsBySession.get(a.session_id) ?? [];
      arr.push(a);
      attemptsBySession.set(a.session_id, arr);
    }

    setSessions(
      rows.map((r) => {
        const attempts = attemptsBySession.get(r.id) ?? [];
        const submitted = attempts.filter((a) => a.completed);
        const avgScore =
          submitted.length === 0
            ? 0
            : Math.round(submitted.reduce((acc, a) => acc + a.score, 0) / submitted.length);
        const maxScore = submitted.length > 0 ? Math.max(...submitted.map((a) => a.score), 1) : 1;
        const avgPercent =
          maxScore > 0 ? Math.min(100, Math.round((avgScore / maxScore) * 100)) : 0;
        return {
          ...r,
          categoryName: r.category_id ? (catNames.get(r.category_id) ?? "") : "",
          subcategoryName: r.subcategory_id ? (subNames.get(r.subcategory_id) ?? "") : "",
          attempts,
          avgPercent,
          avgScore,
        };
      }),
    );
  }, [filterDateFrom, filterDateTo, filterTitle, filterType, page, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (!expandedAttempts[id] && !expandingIds.has(id)) {
          setExpandingIds((s) => new Set(s).add(id));
          supabase
            .from("quiz_attempts")
            .select(
              "id, session_id, participant_id, participant_name, participant_email, score, total_questions, completed, completed_at, participants ( metadata )",
            )
            .eq("session_id", id)
            .order("score", { ascending: false })
            .then(({ data, error }) => {
              setExpandingIds((s) => {
                const n = new Set(s);
                n.delete(id);
                return n;
              });
              if (!error && data)
                setExpandedAttempts((cur) => ({ ...cur, [id]: data as AttemptRow[] }));
            });
        }
      }
      return next;
    });
  };

  const loadVisibleAnswerStats = useCallback(async (sessionId: string, attemptIds: string[]) => {
    if (attemptIds.length === 0) return;
    const { data, error } = await supabase
      .from("quiz_answers")
      .select("attempt_id, is_correct")
      .in("attempt_id", attemptIds);
    if (error) return;
    const next: Record<string, { correct: number; wrong: number; attempted: number }> = {};
    for (const id of attemptIds) next[id] = { correct: 0, wrong: 0, attempted: 0 };
    for (const row of data ?? []) {
      const bucket = next[row.attempt_id];
      if (!bucket) continue;
      bucket.attempted += 1;
      if (row.is_correct === true) bucket.correct += 1;
      if (row.is_correct === false) bucket.wrong += 1;
    }
    setAttemptAnswerStats((current) => ({ ...current, [sessionId]: next }));
  }, []);

  // react-doctor-disable-next-line react-doctor/no-derived-state-effect
  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-chain-state-updates
    setPage(0);
  }, [filterTitle, filterType, filterDateFrom, filterDateTo]);

  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-event-handler
    const openSessionRows = sessions.filter((session) => openIds.has(session.id));
    // react-doctor-disable-next-line react-doctor/no-event-handler
    for (const session of openSessionRows) {
      // react-doctor-disable-next-line react-doctor/no-event-handler
      const attempts = expandedAttempts[session.id] ?? session.attempts;
      // react-doctor-disable-next-line react-doctor/no-event-handler
      const reportRows = getQuizReportRows(
        attempts.map((a) => toReportAttempt(a, sessionMaxPts[session.id])),
      );
      const submitted = reportRows.filter((row) => row.completed);
      // react-doctor-disable-next-line react-doctor/no-event-handler
      const attemptPage = attemptPages[session.id] ?? 0;
      // react-doctor-disable-next-line react-doctor/no-event-handler
      const visibleSubmitted = paginate(submitted, attemptPage, HISTORY_PAGE_SIZE);
      const visibleIds = visibleSubmitted.map((row) => row.id);
      // react-doctor-disable-next-line react-doctor/no-event-handler
      const existing = attemptAnswerStats[session.id];
      const needsLoad = visibleIds.some((id) => !existing?.[id]);
      if (needsLoad) void loadVisibleAnswerStats(session.id, visibleIds);
    }
  }, [
    sessions,
    openIds,
    attemptPages,
    attemptAnswerStats,
    loadVisibleAnswerStats,
    expandedAttempts,
    sessionMaxPts,
  ]);

  const hasFilters = !!(filterTitle || filterType || filterDateFrom || filterDateTo);

  const clearFilters = () => {
    setFilterTitle("");
    setFilterType("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const trendData = useMemo(() => buildHistoryTrends(sessions), [sessions]);

  const totalParticipants = useMemo(
    () => sessions.reduce((s, sess) => s + sess.attempts.filter((a) => a.completed).length, 0),
    [sessions],
  );
  const overallAvg = useMemo(() => {
    const withData = sessions.filter((s) => s.avgPercent > 0);
    if (!withData.length) return 0;
    return Math.round(withData.reduce((s, sess) => s + sess.avgPercent, 0) / withData.length);
  }, [sessions]);

  return {
    sessions,
    sessionTotal,
    loading,
    openIds,
    profile,
    filterTitle,
    setFilterTitle,
    filterType,
    setFilterType,
    filterDateFrom,
    setFilterDateFrom,
    filterDateTo,
    setFilterDateTo,
    showFilters,
    setShowFilters,
    page,
    setPage,
    attemptPages,
    setAttemptPages,
    expandedAttempts,
    expandingIds,
    attemptAnswerStats,
    sessionMaxPts,
    downloadOpenId,
    setDownloadOpenId,
    downloadRef,
    hasFilters,
    clearFilters,
    trendData,
    totalParticipants,
    overallAvg,
    toggle,
  };
}
