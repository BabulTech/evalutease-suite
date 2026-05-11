import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Crown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Printer,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadQuizReportCsv, getQuizReportRows, type QuizReportAttempt } from "@/lib/quiz-reports";
import { PaginationControls } from "@/components/PaginationControls";
import { paginate } from "@/lib/pagination";
import type { HistoryTrends } from "@/components/history/HistoryTrendCharts";

export const Route = createFileRoute("/_app/quiz-history")({
  component: QuizHistoryPage,
});

const HISTORY_PAGE_SIZE = 25;
const LazyHistoryTrendCharts = lazy(() => import("@/components/history/HistoryTrendCharts"));

type SessionRow = {
  id: string;
  title: string;
  created_at: string;
  category_id: string | null;
  subcategory_id: string | null;
  default_time_per_question: number | null;
  subject: string | null;
  topic: string | null;
  description: string | null;
};

type AttemptRow = {
  id: string;
  session_id: string;
  participant_id: string | null;
  participant_name: string | null;
  participant_email: string | null;
  score: number;
  total_questions: number;
  completed: boolean;
  completed_at: string | null;
  participants: { metadata: unknown } | null;
};

type SessionWithStats = SessionRow & {
  categoryName: string;
  subcategoryName: string;
  attempts: AttemptRow[];
  avgPercent: number;
};

type ProfileRow = {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  organization: string | null;
};

const QUIZ_TYPE_LABELS: Record<string, string> = {
  mcq: "MCQ",
  true_false: "True / False",
  mixed: "Mixed",
  short_answer: "Short Answer",
  descriptive: "Descriptive",
};

function QuizHistoryPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  // Filters
  const [filterTitle, setFilterTitle] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [attemptPages, setAttemptPages] = useState<Record<string, number>>({});
  // Full attempts (with participants.metadata) fetched lazily when a session is expanded
  const [expandedAttempts, setExpandedAttempts] = useState<Record<string, AttemptRow[]>>({});
  const [expandingIds, setExpandingIds] = useState<Set<string>>(new Set());
  const [attemptAnswerStats, setAttemptAnswerStats] = useState<
    Record<string, Record<string, { correct: number; wrong: number; attempted: number }>>
  >({});

  // Download dropdown per session
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
        "id, title, created_at, category_id, subcategory_id, default_time_per_question, subject, topic, description",
        { count: "exact" },
      )
      .eq("owner_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .range(offset, offset + HISTORY_PAGE_SIZE - 1);
    if (filterTitle.trim()) {
      sessionQuery = sessionQuery.ilike("title", `%${filterTitle.trim()}%`);
    }
    if (filterType) {
      sessionQuery = sessionQuery.eq("topic", filterType);
    }
    if (filterDateFrom) {
      sessionQuery = sessionQuery.gte("created_at", `${filterDateFrom}T00:00:00`);
    }
    if (filterDateTo) {
      sessionQuery = sessionQuery.lte("created_at", `${filterDateTo}T23:59:59`);
    }
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
      new Set(rows.map((r) => r.subcategory_id).filter((v): v is string => !!v)),
    );
    const catIds = Array.from(
      new Set(rows.map((r) => r.category_id).filter((v): v is string => !!v)),
    );

    const [attemptsRes, subRes, catRes, profileRes] = await Promise.all([
      supabase
        .from("quiz_attempts")
        // No participants join here - lightweight for stats only.
        // Full data (with metadata for roll/seat) is fetched lazily on expand.
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
    ]);
    setLoading(false);
    if (attemptsRes.error) toast.error(attemptsRes.error.message);
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
        const avgPercent =
          submitted.length === 0
            ? 0
            : Math.round(
                submitted.reduce(
                  (acc, a) => acc + (a.score / Math.max(1, a.total_questions)) * 100,
                  0,
                ) / submitted.length,
              );
        return {
          ...r,
          categoryName: r.category_id ? catNames.get(r.category_id) ?? "" : "",
          subcategoryName: r.subcategory_id ? subNames.get(r.subcategory_id) ?? "" : "",
          attempts,
          avgPercent,
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
        // Lazy-load full attempts (with participants.metadata for roll/seat) on first open
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
              setExpandingIds((s) => { const n = new Set(s); n.delete(id); return n; });
              if (!error && data) {
                setExpandedAttempts((cur) => ({ ...cur, [id]: data as AttemptRow[] }));
              }
            });
        }
      }
      return next;
    });
  };

  const loadVisibleAnswerStats = useCallback(
    async (sessionId: string, attemptIds: string[]) => {
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
    },
    [],
  );

  // Print only the specific quiz section. Caller must pass the full attempts (with metadata).
  const printQuiz = (s: SessionWithStats, attempts: AttemptRow[]) => {
    const reportRows = getQuizReportRows(attempts.map(toReportAttempt));
    const submitted = reportRows.filter((a) => a.completed);
    const teacherName = getTeacherName(profile, user?.email);
    const schoolName = profile?.organization ?? "";

    const rows = submitted
      .map(
        (a) => `
      <tr>
        <td>${a.rank}</td>
        <td>${a.name}</td>
        <td>${a.email || "-"}</td>
        <td>${a.rollNumber || "-"}</td>
        <td>${a.score}</td>
        <td>${a.attemptedQuestions}/${a.totalQuestions}</td>
        <td>${a.correctAnswers}</td>
        <td>${a.wrongAnswers}</td>
        <td>${a.unattemptedQuestions}</td>
      </tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html><html><head><title>${s.title} - Report</title>
    <style>
      body { font-family: sans-serif; padding: 24px; color: #111; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      .meta { font-size: 12px; color: #555; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th { background: #f3f4f6; text-align: left; padding: 8px 10px; border-bottom: 2px solid #e5e7eb; }
      td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
      tr:nth-child(even) td { background: #f9fafb; }
    </style></head><body>
    <h1>${s.title}</h1>
    <div class="meta">
      Teacher: ${teacherName} · School: ${schoolName || "Not specified"} ·
      Type: ${QUIZ_TYPE_LABELS[s.topic ?? ""] ?? s.topic ?? "-"} ·
      Date: ${new Date(s.created_at).toLocaleDateString()} ·
      Avg Score: ${s.avgPercent}%
    </div>
    <table>
      <thead><tr>
        <th>Rank</th><th>Name</th><th>Email</th><th>Roll</th>
        <th>Score</th><th>Attempted</th><th>Correct</th><th>Wrong</th><th>Unattempted</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.print();
  };

  // Print the full history page
  const printAll = () => {
    window.print();
  };

  const hasFilters = filterTitle || filterType || filterDateFrom || filterDateTo;
  const trendData = useMemo(() => buildHistoryTrends(sessions), [sessions]);

  useEffect(() => {
    setPage(0);
  }, [filterTitle, filterType, filterDateFrom, filterDateTo]);

  const clearFilters = () => {
    setFilterTitle("");
    setFilterType("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  useEffect(() => {
    const openSessionRows = sessions.filter((session) => openIds.has(session.id));
    for (const session of openSessionRows) {
      const attempts = expandedAttempts[session.id] ?? session.attempts;
      const reportRows = getQuizReportRows(attempts.map(toReportAttempt));
      const submitted = reportRows.filter((row) => row.completed);
      const attemptPage = attemptPages[session.id] ?? 0;
      const visibleSubmitted = paginate(submitted, attemptPage, HISTORY_PAGE_SIZE);
      const visibleIds = visibleSubmitted.map((row) => row.id);
      const existing = attemptAnswerStats[session.id];
      const needsLoad = visibleIds.some((id) => !existing?.[id]);
      if (needsLoad) {
        void loadVisibleAnswerStats(session.id, visibleIds);
      }
    }
  }, [sessions, openIds, attemptPages, attemptAnswerStats, loadVisibleAnswerStats, expandedAttempts]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{t("hist.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("hist.desc")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="h-3.5 w-3.5" />
            {t("hist.filters")}
            {hasFilters && (
              <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                !
              </span>
            )}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 print:hidden" onClick={printAll}>
            <Printer className="h-3.5 w-3.5" /> {t("hist.printAll")}
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3 print:hidden">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t("hist.filterHistory")}</span>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={clearFilters}>
                <X className="h-3 w-3" /> {t("hist.clearAll")}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{t("hist.quizTitle")}</label>
              <Input
                placeholder={t("hist.searchTitle")}
                value={filterTitle}
                onChange={(e) => setFilterTitle(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{t("hist.quizType")}</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">{t("hist.allTypes")}</option>
                {Object.entries(QUIZ_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{t("hist.fromDate")}</label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{t("hist.toDate")}</label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          {hasFilters && (
            <p className="text-xs text-muted-foreground">
              {t("hist.showing")} {sessions.length} {t("common.of")} {sessionTotal} {t("hist.sessions")}
            </p>
          )}
        </div>
      )}

      {sessions.length > 0 && (
        <Suspense fallback={<div className="rounded-2xl border border-border bg-card/40 p-4 text-xs text-muted-foreground">Loading charts...</div>}>
          <LazyHistoryTrendCharts trends={trendData} />
        </Suspense>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : sessions.length === 0 && !hasFilters ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
          <Archive className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">{t("hist.empty")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("hist.emptyHint")}</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
          <Filter className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">{t("hist.noMatch")}</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={clearFilters}>
            {t("hist.clearFilters")}
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => {
            const isOpen = openIds.has(s.id);
            const fullAttempts = expandedAttempts[s.id] ?? s.attempts;
            const reportRows = getQuizReportRows(fullAttempts.map(toReportAttempt));
            const submitted = reportRows.filter((a) => a.completed);
            const attemptPage = attemptPages[s.id] ?? 0;
            const visibleSubmitted = paginate(submitted, attemptPage, HISTORY_PAGE_SIZE);
            const isLoadingExpand = expandingIds.has(s.id);
            const top = submitted[0];
            const teacherName = getTeacherName(profile, user?.email);
            const schoolName = profile?.organization ?? "";
            const quizTypeLabel = QUIZ_TYPE_LABELS[s.topic ?? ""] ?? s.topic ?? "-";

            return (
              <li
                key={s.id}
                className="rounded-2xl border border-border bg-card/60 transition-all hover:border-primary/30 hover:shadow-glow"
              >
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  className="w-full flex items-center justify-between gap-3 p-5 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <div className="font-display text-lg font-bold truncate">{s.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground flex flex-wrap gap-x-2">
                        <span>
                          {[s.categoryName, s.subcategoryName].filter(Boolean).join(" → ") ||
                            t("hist.uncategorised")}
                        </span>
                        {s.topic && (
                          <>
                            <span>·</span>
                            <span className="text-primary/80">{quizTypeLabel}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>{new Date(s.created_at).toLocaleDateString()}</span>
                        <span>·</span>
                        <span>{submitted.length} {t("hist.submitted")}</span>
                        <span>·</span>
                        <span>{s.avgPercent}% {t("hist.avg")}</span>
                      </div>
                    </div>
                  </div>
                  {top && (
                    <div className="hidden sm:flex items-center gap-2 text-xs">
                      <Crown className="h-3.5 w-3.5 text-warning" />
                      <span className="font-medium truncate max-w-[120px]">{top.name}</span>
                      <span className="text-success font-bold">
                        {top.score}/{top.totalQuestions}
                      </span>
                    </div>
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-border p-4" id={`history-report-${s.id}`}>
                    {isLoadingExpand && (
                      <p className="mb-3 text-xs text-muted-foreground">{t("hist.loadingReport")}</p>
                    )}
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
                      <div>
                        <div className="text-xs font-semibold">{t("hist.finalReport")}</div>
                        <p className="text-xs text-muted-foreground">{t("hist.reportDesc")}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("hist.teacher")}: {teacherName} · {t("hist.school")}: {schoolName || t("hist.notSpecified")} · {t("hist.type")}:{" "}
                          {quizTypeLabel} · {t("hist.subject")}: {subjectLabel(s)}
                        </p>
                      </div>
                      <div className="flex gap-2" ref={downloadRef}>
                        {/* Print this quiz */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => printQuiz(s, fullAttempts)}
                          className="gap-1.5"
                        >
                          <Printer className="h-3.5 w-3.5" /> {t("hist.print")}
                        </Button>

                        {/* Download dropdown */}
                        <div className="relative">
                          <Button
                            size="sm"
                            onClick={() =>
                              setDownloadOpenId((prev) => (prev === s.id ? null : s.id))
                            }
                            className="gap-1.5 bg-gradient-primary text-primary-foreground"
                          >
                            <Download className="h-3.5 w-3.5" /> {t("hist.download")}
                            <ChevronDown className="h-3 w-3 ml-0.5" />
                          </Button>
                          {downloadOpenId === s.id && (
                            <div className="absolute right-0 mt-1 w-40 rounded-xl border border-border bg-card shadow-card z-10 overflow-hidden">
                              <button
                                type="button"
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-sidebar-accent transition-colors"
                                onClick={() => {
                                  setDownloadOpenId(null);
                                  downloadQuizReportCsv({
                                    title: s.title,
                                    categoryLabel: [s.categoryName, s.subcategoryName]
                                      .filter(Boolean)
                                      .join(" -> "),
                                    teacherName,
                                    schoolName,
                                    subjectLabel: subjectLabel(s),
                                    topicLabel: quizTypeLabel,
                                    createdAt: s.created_at,
                                    questionCount: fullAttempts[0]?.total_questions ?? 0,
                                    attempts: fullAttempts.map(toReportAttempt),
                                  });
                                }}
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5 text-success" /> Excel (CSV)
                              </button>
                              <button
                                type="button"
                                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-sidebar-accent transition-colors"
                                onClick={() => {
                                  setDownloadOpenId(null);
                                  printQuiz(s);
                                }}
                              >
                                <FileText className="h-3.5 w-3.5 text-primary" /> PDF (Print)
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {submitted.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {t("hist.noParticipants")}
                      </p>
                    ) : (
                      <>
                      <ol className="space-y-1.5">
                        {visibleSubmitted.map((a) => {
                          const stats = attemptAnswerStats[s.id]?.[a.id];
                          const correct = stats?.correct ?? a.correctAnswers;
                          const wrong = stats?.wrong ?? a.wrongAnswers;
                          const attempted = stats?.attempted ?? a.attemptedQuestions;
                          const skipped = Math.max(0, a.totalQuestions - attempted);
                          return (
                          <li
                            key={a.id}
                            className="flex items-center gap-3 rounded-lg bg-secondary/40 hover:bg-secondary/60 hover:shadow-glow px-3 py-2 transition-all"
                          >
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                              {a.rank}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold truncate">{a.name}</div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {[
                                  a.email || t("hist.noEmail"),
                                  a.rollNumber ? `${t("hist.rollN")} ${a.rollNumber}` : "",
                                  a.seatNumber ? `${t("hist.seatN")} ${a.seatNumber}` : "",
                                  `${correct} ${t("hist.correct")}`,
                                  `${wrong} ${t("hist.wrong")}`,
                                  `${skipped} ${t("hist.unattempted")}`,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-success">{a.score} {t("hist.pts")}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {attempted}/{a.totalQuestions} {t("hist.attempted")}
                              </div>
                              {a.completedAt && (
                                <div className="text-[10px] text-muted-foreground">
                                  {new Date(a.completedAt).toLocaleTimeString()}
                                </div>
                              )}
                            </div>
                          </li>
                        )})}
                      </ol>
                      <PaginationControls
                        page={attemptPage}
                        pageSize={HISTORY_PAGE_SIZE}
                        total={submitted.length}
                        label="participants"
                        onPageChange={(nextPage) =>
                          setAttemptPages((current) => ({ ...current, [s.id]: nextPage }))
                        }
                      />
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          <PaginationControls
            page={page}
            pageSize={HISTORY_PAGE_SIZE}
            total={sessionTotal}
            label="sessions"
            onPageChange={setPage}
          />
        </ul>
      )}
    </div>
  );
}

function buildHistoryTrends(sessions: SessionWithStats[]): HistoryTrends {
  const weekly = new Map<string, { scoreSum: number; count: number; participants: number }>();
  const monthly = new Map<string, { completed: number; total: number; quizzes: number }>();

  for (const session of sessions) {
    const createdAt = new Date(session.created_at);
    const weekLabel = `${createdAt.getFullYear()}-W${getWeekOfYear(createdAt)}`;
    const monthLabel = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}`;
    const completedAttempts = session.attempts.filter((attempt) => attempt.completed);
    const participantCount = session.attempts.length;

    const week = weekly.get(weekLabel) ?? { scoreSum: 0, count: 0, participants: 0 };
    week.scoreSum += session.avgPercent;
    week.count += 1;
    week.participants += participantCount;
    weekly.set(weekLabel, week);

    const month = monthly.get(monthLabel) ?? { completed: 0, total: 0, quizzes: 0 };
    month.completed += completedAttempts.length;
    month.total += participantCount;
    month.quizzes += 1;
    monthly.set(monthLabel, month);
  }

  const weeklyKeys = Array.from(weekly.keys()).sort().slice(-12);
  const monthlyKeys = Array.from(monthly.keys()).sort().slice(-12);

  return {
    weeklyAverage: weeklyKeys.map((label) => {
      const row = weekly.get(label)!;
      return { label, avgScore: Math.round(row.scoreSum / Math.max(1, row.count)) };
    }),
    weeklyParticipants: weeklyKeys.map((label) => ({
      label,
      participants: weekly.get(label)!.participants,
    })),
    monthlyCompletion: monthlyKeys.map((label) => {
      const row = monthly.get(label)!;
      return {
        label,
        completionRate: Math.round((row.completed / Math.max(1, row.total)) * 100),
      };
    }),
    monthlyQuizCount: monthlyKeys.map((label) => ({
      label,
      quizzes: monthly.get(label)!.quizzes,
    })),
  };
}

function getWeekOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const diffDays = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return Math.ceil((diffDays + start.getDay() + 1) / 7);
}

function toReportAttempt(a: AttemptRow): QuizReportAttempt {
  const meta =
    a.participants?.metadata && typeof a.participants.metadata === "object"
      ? (a.participants.metadata as Record<string, unknown>)
      : {};
  const assumedCorrect = Math.max(0, Math.min(a.score, a.total_questions));
  const attemptedQuestions = a.completed ? a.total_questions : 0;
  const correctAnswers = a.completed ? assumedCorrect : 0;
  const wrongAnswers = a.completed ? Math.max(0, a.total_questions - assumedCorrect) : 0;
  const unattemptedQuestions = a.completed ? 0 : a.total_questions;
  return {
    id: a.id,
    name: a.participant_name ?? "Anonymous",
    email: a.participant_email,
    rollNumber: stringMeta(meta.roll_number),
    seatNumber: stringMeta(meta.seat_number),
    score: a.score,
    totalQuestions: a.total_questions,
    attemptedQuestions,
    correctAnswers,
    wrongAnswers,
    unattemptedQuestions,
    completed: a.completed,
    completedAt: a.completed_at,
  };
}

function subjectLabel(
  s: Pick<SessionWithStats, "subject" | "categoryName" | "subcategoryName">,
) {
  return (
    s.subject ||
    [s.categoryName, s.subcategoryName].filter(Boolean).join(" -> ") ||
    "Not specified"
  );
}

function getTeacherName(profile: ProfileRow | null, email?: string | null) {
  const full = profile?.full_name?.trim();
  if (full) return full;
  const joined = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  return joined || email?.split("@")[0] || "Teacher";
}

function stringMeta(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
