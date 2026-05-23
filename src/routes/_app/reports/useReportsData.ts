import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getQuizReportRows, type QuizReportAttempt, type QuizReportRow } from "@/lib/quiz-reports";
import type { User } from "@supabase/supabase-js";
import type { PlanInfo } from "@/contexts/PlanContext";
import { REPORT_PAGE_SIZE } from "./types";
import type {
  SessionRow,
  ReportSession,
  ProfileRow,
  ReportMode,
  StudentMode,
  DateRange,
  StatusFilter,
  SortOption,
  StudentAttemptRow,
  StudentSummaryRow,
} from "./types";
import {
  subjectLabel,
  categoryLabel,
  toReportAttempt,
  sortRows,
  computeQuizStats,
  aggregateByStudent,
  buildFilterSummary,
  getTeacherName,
} from "./helpers";

export function useReportsData(
  user: User | null,
  plan: PlanInfo | null,
  credits: { balance: number },
  reloadPlan: () => void,
) {
  const [sessions, setSessions] = useState<ReportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [reportMode, setReportMode] = useState<ReportMode>("quiz");
  const [studentMode, setStudentMode] = useState<StudentMode>("attempts");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [passMark, setPassMark] = useState<number>(50);
  const [sort, setSort] = useState<SortOption>("rank");
  const [quizListPage, setQuizListPage] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [selectedAttempts, setSelectedAttempts] = useState<QuizReportAttempt[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [studentAttempts, setStudentAttempts] = useState<Record<string, QuizReportAttempt[]>>({});

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const offset = quizListPage * REPORT_PAGE_SIZE;
    let q = supabase
      .from("quiz_sessions")
      .select("id, title, created_at, category_id, subcategory_id, subject, topic, description", {
        count: "exact",
      })
      .eq("owner_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .range(offset, offset + REPORT_PAGE_SIZE - 1);
    if (query.trim()) q = q.ilike("title", `%${query.trim()}%`);
    if (dateRange !== "all") {
      const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      q = q.gte("created_at", cutoff);
    }
    const { data, error, count } = await q;
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    const rows = (data ?? []) as SessionRow[];
    setSessionTotal(count ?? 0);
    if (rows.length === 0) {
      setSessions([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }

    const subIds = Array.from(
      new Set(rows.flatMap((r) => (r.subcategory_id ? [r.subcategory_id] : []))),
    ) as string[];
    const catIds = Array.from(
      new Set(rows.flatMap((r) => (r.category_id ? [r.category_id] : []))),
    ) as string[];

    const [subRes, catRes, profileRes] = await Promise.all([
      subIds.length
        ? supabase.from("question_subcategories").select("id, name").in("id", subIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
      catIds.length
        ? supabase.from("question_categories").select("id, name").in("id", catIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
      supabase
        .from("profiles")
        .select("full_name, first_name, last_name, organization")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    setLoading(false);
    if (profileRes.data) setProfile(profileRes.data as ProfileRow);

    const subNames = new Map((subRes.data ?? []).map((s) => [s.id, s.name]));
    const catNames = new Map((catRes.data ?? []).map((c) => [c.id, c.name]));

    const next = rows.map((row) => ({
      ...row,
      categoryName: row.category_id ? (catNames.get(row.category_id) ?? "") : "",
      subcategoryName: row.subcategory_id ? (subNames.get(row.subcategory_id) ?? "") : "",
    }));
    setSessions(next);
    setSelectedId((current) => current ?? next[0]?.id ?? null);
  }, [user, quizListPage, query, dateRange]);

  useEffect(() => {
    void load();
  }, [load]);

  const subjectOptions = useMemo(() => {
    const set = new Map<string, string>();
    for (const s of sessions) {
      const label = subjectLabel(s);
      if (label && label !== "Not specified") set.set(label, label);
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [sessions]);

  // react-doctor-disable-next-line react-doctor/no-event-handler
  const filteredSessions = useMemo(() => {
    // react-doctor-disable-next-line react-doctor/no-event-handler
    if (subjectFilter === "all") return sessions;
    return sessions.filter((s) => subjectLabel(s) === subjectFilter);
  }, [sessions, subjectFilter]);

  // react-doctor-disable-next-line react-doctor/no-chain-state-updates
  // react-doctor-disable-next-line react-doctor/no-derived-state-effect
  // react-doctor-disable-next-line react-doctor/no-chain-state-updates
  useEffect(() => {
    setQuizListPage(0);
  }, [query, dateRange, subjectFilter, reportMode]);

  const selected = useMemo(() => {
    if (!selectedId) return filteredSessions[0] ?? null;
    return (
      filteredSessions.find((s) => s.id === selectedId) ??
      sessions.find((s) => s.id === selectedId) ??
      filteredSessions[0] ??
      null
    );
  }, [selectedId, filteredSessions, sessions]);

  useEffect(() => {
    const loadSelectedAttempts = async () => {
      if (!selectedId) {
        setSelectedAttempts([]);
        return;
      }
      // react-doctor-disable-next-line react-doctor/no-event-handler
      setAttemptsLoading(true);
      const [attemptsRes, maxPtsRes] = await Promise.all([
        supabase
          .from("quiz_attempts")
          .select(
            "id, participant_name, participant_email, score, total_questions, completed, started_at, completed_at, participants ( metadata )",
          )
          // react-doctor-disable-next-line react-doctor/no-event-handler
          .eq("session_id", selectedId)
          .order("score", { ascending: false }),
        supabase
          .from("quiz_session_questions")
          .select("questions(max_points)")
          .eq("session_id", selectedId),
      ]);
      if (attemptsRes.error) {
        setAttemptsLoading(false);
        toast.error(attemptsRes.error.message);
        setSelectedAttempts([]);
        return;
      }
      const totalMaxPoints = maxPtsRes.data
        ? maxPtsRes.data.reduce(
            (sum, r) => sum + ((r.questions as { max_points?: number } | null)?.max_points ?? 1),
            0,
          )
        : null;

      const attemptIds = (attemptsRes.data ?? []).map((a) => a.id);
      const liveScores: Record<string, number> = {};
      if (attemptIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: ansData } = await (supabase as any)
          .from("quiz_answers")
          .select("attempt_id, points_awarded")
          .in("attempt_id", attemptIds);
        for (const r of (ansData ?? []) as {
          attempt_id: string;
          points_awarded: number | null;
        }[]) {
          liveScores[r.attempt_id] = (liveScores[r.attempt_id] ?? 0) + (r.points_awarded ?? 0);
        }
      }
      setAttemptsLoading(false);
      setSelectedAttempts(
        ((attemptsRes.data ?? []) as import("./types").AttemptRow[]).map((a) =>
          toReportAttempt({ ...a, score: liveScores[a.id] ?? a.score }, totalMaxPoints),
        ),
      );
    };
    void loadSelectedAttempts();
  }, [selectedId]);

  const baseRows: QuizReportRow[] = useMemo(
    () => getQuizReportRows(selectedAttempts),
    [selectedAttempts],
  );

  const filteredRows = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    const filtered = baseRows.filter((row) => {
      const statusOk =
        statusFilter === "all" || (statusFilter === "completed" ? row.completed : !row.completed);
      if (!statusOk) return false;
      if (!q) return true;
      return [row.name, row.email, row.rollNumber, row.seatNumber]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    return sortRows(filtered, sort);
  }, [baseRows, statusFilter, studentQuery, sort]);

  const studentAttemptRows = useMemo<StudentAttemptRow[]>(() => {
    const q = studentQuery.trim().toLowerCase();
    const all = filteredSessions.flatMap((session) =>
      getQuizReportRows(studentAttempts[session.id] ?? []).map((row) => ({
        ...row,
        sessionId: session.id,
        sessionTitle: session.title,
        sessionCategory: categoryLabel(session),
        sessionCreatedAt: session.created_at,
      })),
    );
    const filtered = all.filter((row) => {
      const statusOk =
        statusFilter === "all" || (statusFilter === "completed" ? row.completed : !row.completed);
      if (!statusOk) return false;
      if (!q) return true;
      return [
        row.name,
        row.email,
        row.rollNumber,
        row.seatNumber,
        row.sessionTitle,
        row.sessionCategory,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    return sortRows(filtered, sort);
  }, [filteredSessions, studentAttempts, statusFilter, studentQuery, sort]);

  useEffect(() => {
    const loadStudentModeAttempts = async () => {
      if (reportMode !== "student") return;
      const sessionIds = filteredSessions.map((s) => s.id);
      if (sessionIds.length === 0) {
        setStudentAttempts({});
        return;
      }
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select(
          "id, session_id, participant_name, participant_email, score, total_questions, completed, started_at, completed_at, participants ( metadata )",
        )
        .in("session_id", sessionIds);
      if (error) {
        toast.error(error.message);
        return;
      }
      const maxPtsRes = await supabase
        .from("quiz_session_questions")
        .select("session_id, questions(max_points)")
        .in("session_id", sessionIds);
      const sessionMaxPts: Record<string, number> = {};
      for (const r of maxPtsRes.data ?? []) {
        const sid = r.session_id as string;
        sessionMaxPts[sid] =
          (sessionMaxPts[sid] ?? 0) +
          ((r.questions as { max_points?: number } | null)?.max_points ?? 1);
      }
      const attemptIds = (data ?? []).map((a) => a.id);
      const liveScores: Record<string, number> = {};
      if (attemptIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: ansData } = await (supabase as any)
          .from("quiz_answers")
          .select("attempt_id, points_awarded")
          .in("attempt_id", attemptIds);
        for (const r of (ansData ?? []) as {
          attempt_id: string;
          points_awarded: number | null;
        }[]) {
          liveScores[r.attempt_id] = (liveScores[r.attempt_id] ?? 0) + (r.points_awarded ?? 0);
        }
      }
      const grouped: Record<string, QuizReportAttempt[]> = {};
      for (const sessionId of sessionIds) grouped[sessionId] = [];
      for (const attempt of (data ?? []) as (import("./types").AttemptRow & {
        session_id: string;
      })[]) {
        grouped[attempt.session_id].push(
          toReportAttempt(
            { ...attempt, score: liveScores[attempt.id] ?? attempt.score },
            sessionMaxPts[attempt.session_id] ?? null,
          ),
        );
      }
      setStudentAttempts(grouped);
    };
    void loadStudentModeAttempts();
  }, [reportMode, filteredSessions]);

  const studentSummaryRows: StudentSummaryRow[] = useMemo(
    () => aggregateByStudent(studentAttemptRows),
    [studentAttemptRows],
  );
  const stats = useMemo(() => computeQuizStats(filteredRows, passMark), [filteredRows, passMark]);

  const teacherName = getTeacherName(profile, user?.email);
  const schoolName = profile?.organization ?? "";

  const resetFilters = () => {
    setQuery("");
    setStudentQuery("");
    setStatusFilter("all");
    setDateRange("all");
    setSubjectFilter("all");
    setPassMark(50);
    setSort("rank");
  };

  const filterSummary = buildFilterSummary({
    dateRange,
    subjectFilter,
    statusFilter,
    passMark,
    studentQuery,
    sort,
  });

  const deductExportCredit = async (): Promise<boolean> => {
    const cost = plan?.credit_cost_export ?? 0;
    if (!cost || !user) return true;
    if (credits.balance < cost) {
      toast.error(
        `Need ${cost} credits to export. You have ${credits.balance}. Buy more in Billing.`,
      );
      return false;
    }
    const { data: ok } = await supabase.rpc("deduct_credits", {
      p_user_id: user.id,
      p_amount: cost,
      p_type: "extra_quiz",
      p_description: `Report export: ${selected?.title ?? ""}`,
    });
    if (ok) reloadPlan();
    return !!ok;
  };

  return {
    sessions,
    loading,
    profile,
    reportMode,
    setReportMode,
    studentMode,
    setStudentMode,
    selectedId,
    setSelectedId,
    selected,
    query,
    setQuery,
    studentQuery,
    setStudentQuery,
    statusFilter,
    setStatusFilter,
    dateRange,
    setDateRange,
    subjectFilter,
    setSubjectFilter,
    passMark,
    setPassMark,
    sort,
    setSort,
    quizListPage,
    setQuizListPage,
    sessionTotal,
    selectedAttempts,
    attemptsLoading,
    filteredSessions,
    subjectOptions,
    baseRows,
    filteredRows,
    studentAttemptRows,
    studentSummaryRows,
    stats,
    teacherName,
    schoolName,
    resetFilters,
    filterSummary,
    deductExportCredit,
  };
}
