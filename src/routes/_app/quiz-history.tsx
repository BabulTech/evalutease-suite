import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Clock,
  Crown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  PenLine,
  Printer,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadQuizReportCsv, getQuizReportRows, printQuizResults, formatDuration, type QuizReportAttempt } from "@/lib/quiz-reports";
import { usePlan } from "@/contexts/PlanContext";
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
  status: string;
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
  avgScore: number;
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
  const { plan } = usePlan();
  const navigate = useNavigate();
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
  const [sessionMaxPts, setSessionMaxPts] = useState<Record<string, number>>({});

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
        "id, title, status, created_at, category_id, subcategory_id, default_time_per_question, subject, topic, description",
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

    const [attemptsRes, subRes, catRes, profileRes, maxPtsRes] = await Promise.all([
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
      supabase
        .from("quiz_session_questions")
        .select("session_id, questions(max_points)")
        .in("session_id", sessionIds),
    ]);
    if (attemptsRes.error) toast.error(attemptsRes.error.message);

    // Recompute live scores from quiz_answers
    const attemptIds = (attemptsRes.data ?? []).map((a) => a.id);
    const liveScores: Record<string, number> = {};
    if (attemptIds.length > 0) {
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
      newSessionMaxPts[sid] = (newSessionMaxPts[sid] ?? 0) + ((r.questions as { max_points?: number } | null)?.max_points ?? 1);
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
        const avgPercent = maxScore > 0 ? Math.min(100, Math.round((avgScore / maxScore) * 100)) : 0;
        return {
          ...r,
          categoryName: r.category_id ? catNames.get(r.category_id) ?? "" : "",
          subcategoryName: r.subcategory_id ? subNames.get(r.subcategory_id) ?? "" : "",
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

  // Print a single session — reuses the shared printQuizResults layout
  const printQuiz = (s: SessionWithStats, attempts: AttemptRow[]) => {
    const teacherName = getTeacherName(profile, user?.email);
    const schoolName = profile?.organization ?? "";
    printQuizResults({
      title: s.title,
      categoryLabel: [s.categoryName, s.subcategoryName].filter(Boolean).join(" → "),
      teacherName,
      schoolName,
      subjectLabel: subjectLabel(s),
      topicLabel: QUIZ_TYPE_LABELS[s.topic ?? ""] ?? s.topic ?? "",
      createdAt: s.created_at,
      questionCount: attempts[0]?.total_questions ?? 0,
      attempts: attempts.map((a) => toReportAttempt(a, sessionMaxPts[s.id])),
    });
  };

  // Print ALL sessions — one report block per session in a single window
  const printAll = () => {
    const teacherName = getTeacherName(profile, user?.email);
    const schoolName = profile?.organization ?? "";
    const now = new Date().toLocaleString();
    const esc = (v: unknown) =>
      String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

    const sessionBlocks = sessions.map((s) => {
      const fullAttempts = expandedAttempts[s.id] ?? s.attempts;
      const reportRows = getQuizReportRows(fullAttempts.map((a) => toReportAttempt(a, sessionMaxPts[s.id]))).filter((a) => a.completed);
      const tableRows = reportRows.map((r, i) => `
        <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f9fafb"};">
          <td style="text-align:center;font-weight:700;">${r.rank}</td>
          <td><strong>${esc(r.name)}</strong></td>
          <td>${esc(r.rollNumber) || "-"}</td>
          <td>${esc(r.email) || "-"}</td>
          <td style="text-align:center;">${r.attemptedQuestions}</td>
          <td style="text-align:center;color:#16a34a;font-weight:700;">${r.score}</td>
          <td style="text-align:center;">${formatDuration(r.durationSeconds ?? null)}</td>
          <td style="text-align:center;">${r.unattemptedQuestions}</td>
        </tr>`).join("");

      return `
      <div class="session-block">
        <div class="top-bar">
          <div>
            <div class="app-name">EvaluTease</div>
            <div class="app-sub">Quiz Results Report</div>
          </div>
          <div class="print-date">
            <div>Printed: ${esc(now)}</div>
            <div>Total Participants: ${reportRows.length}</div>
          </div>
        </div>
        <div class="info-grid">
          <div class="info-item"><div class="lbl">Company / School</div><div class="val">${esc(schoolName) || "Not specified"}</div></div>
          <div class="info-item"><div class="lbl">Host / Teacher</div><div class="val">${esc(teacherName)}</div></div>
          <div class="info-item full"><div class="lbl">Quiz Topic</div><div class="val">${esc(s.title)}${s.topic ? " — " + esc(QUIZ_TYPE_LABELS[s.topic] ?? s.topic) : ""}</div></div>
          <div class="info-item"><div class="lbl">Subject</div><div class="val">${esc(subjectLabel(s))}</div></div>
          <div class="info-item"><div class="lbl">Total Questions</div><div class="val">${fullAttempts[0]?.total_questions ?? 0}</div></div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th class="center">Rank</th><th>Participant Name</th><th>Roll Number</th><th>Email</th>
              <th class="center">Attempted</th><th class="center">Points</th>
              <th class="center">Total Time</th><th class="center">Unattempted</th>
            </tr></thead>
            <tbody>${tableRows || '<tr><td colspan="9" style="text-align:center;color:#9ca3af;padding:12px;">No submissions</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>All Quiz Results</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; background: #fff; padding: 20px; }
    .session-block { margin-bottom: 40px; page-break-after: always; }
    .session-block:last-child { page-break-after: auto; }
    .top-bar { background: #6d28d9; color: #fff; padding: 14px 20px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; }
    .top-bar .app-name { font-size: 18px; font-weight: 700; letter-spacing: -0.5px; }
    .top-bar .app-sub { font-size: 10px; opacity: 0.8; margin-top: 2px; }
    .top-bar .print-date { font-size: 10px; opacity: 0.8; text-align: right; }
    .info-grid { border: 1px solid #e5e7eb; border-top: none; padding: 14px 20px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 0; }
    .info-item { padding: 6px 10px 6px 0; border-bottom: 1px solid #f3f4f6; }
    .info-item .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; }
    .info-item .val { font-size: 12px; font-weight: 600; margin-top: 1px; color: #111; }
    .info-item.full { grid-column: 1 / -1; }
    .table-wrap { margin-top: 14px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    thead tr { background: #6d28d9; color: #fff; }
    thead th { padding: 8px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.4px; white-space: nowrap; }
    thead th.center { text-align: center; }
    tbody td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
    tbody tr:last-child td { border-bottom: none; }
    .signature { margin-top: 20px; border-top: 2px solid #6d28d9; padding-top: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
    .sig-left .greeting { font-size: 11px; color: #374151; margin-bottom: 3px; }
    .sig-left .brand { font-size: 17px; font-weight: 700; color: #6d28d9; margin-bottom: 6px; }
    .sig-left .contact { font-size: 10px; color: #6b7280; line-height: 1.8; }
    .sig-right { font-size: 9px; color: #9ca3af; text-align: right; line-height: 1.7; }
    @media print { body { padding: 8px; } @page { margin: 10mm; size: A4 landscape; } }
  </style>
</head>
<body>
  ${sessionBlocks}
  <div class="signature">
    <div class="sig-left">
      <div class="greeting">Warm &amp; Best Regards,</div>
      <div class="brand">BabulQ</div>
      <div class="contact">
        📞 +92 310 2700403<br/>
        ✉️ contact@babultech.com<br/>
        📍 <a href="https://maps.app.goo.gl/68znfMTx4ar17ipD9" style="color:#6d28d9;text-decoration:none;">IDC Office, Islamabad — View on Maps</a>
      </div>
    </div>
    <div class="sig-right">
      <div>© 2025 BabulTech · All rights reserved</div>
      <div>evalutease.com</div>
    </div>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) return;
    win.document.write(html);
    win.document.close();
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
      const reportRows = getQuizReportRows(attempts.map((a) => toReportAttempt(a, sessionMaxPts[session.id])));
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
  }, [sessions, openIds, attemptPages, attemptAnswerStats, loadVisibleAnswerStats, expandedAttempts, sessionMaxPts]);

  const totalParticipants = useMemo(
    () => sessions.reduce((s, sess) => s + sess.attempts.filter((a) => a.completed).length, 0),
    [sessions],
  );
  const overallAvg = useMemo(() => {
    const withData = sessions.filter((s) => s.avgPercent > 0);
    if (!withData.length) return 0;
    return Math.round(withData.reduce((s, sess) => s + sess.avgPercent, 0) / withData.length);
  }, [sessions]);

  const avgColor = overallAvg >= 70 ? "text-success" : overallAvg >= 40 ? "text-warning" : "text-destructive";

  return (
    <div className="space-y-4">
      {/* Hero header */}
      <div className="rounded-2xl border border-border bg-card/60 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow shrink-0">
            <Archive className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight">{t("hist.title")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("hist.desc")}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 print:hidden shrink-0" onClick={printAll}>
          <Printer className="h-3.5 w-3.5" /> {t("hist.printAll")}
        </Button>
      </div>

      {/* Stats strip — only when data exists */}
      {sessionTotal > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border bg-card/50 p-4 text-center">
            <div className="font-display text-2xl font-bold text-primary">{sessionTotal}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Quizzes</div>
          </div>
          <div className="rounded-2xl border border-border bg-card/50 p-4 text-center">
            <div className="font-display text-2xl font-bold text-foreground">{totalParticipants}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Submissions</div>
          </div>
          <div className="rounded-2xl border border-border bg-card/50 p-4 text-center">
            <div className={`font-display text-2xl font-bold ${avgColor}`}>{overallAvg}%</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Avg Score</div>
          </div>
        </div>
      )}

      {/* Search + filter row */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="relative flex-1 min-w-[200px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t("hist.searchTitle")}
            value={filterTitle}
            onChange={(e) => setFilterTitle(e.target.value)}
            className="pl-9 h-9"
          />
          {filterTitle && (
            <button type="button" onClick={() => setFilterTitle("")} aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-9"
          onClick={() => setShowFilters((v) => !v)}>
          <Filter className="h-3.5 w-3.5" /> {t("hist.filters")}
          {hasFilters && <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">!</span>}
        </Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3" /> {t("hist.clearAll")}
          </Button>
        )}
      </div>

      {/* Quiz type chips + date filter panel */}
      {showFilters && (
        <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-4 print:hidden">
          {/* Quiz type chips */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-2">{t("hist.quizType")}</label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setFilterType("")}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                  !filterType ? "border-primary bg-primary/15 text-primary" : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}>
                {t("hist.allTypes")}
              </button>
              {Object.entries(QUIZ_TYPE_LABELS).map(([val, label]) => (
                <button key={val} type="button" onClick={() => setFilterType(val === filterType ? "" : val)}
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                    filterType === val ? "border-primary bg-primary/15 text-primary" : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{t("hist.fromDate")}</label>
              <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{t("hist.toDate")}</label>
              <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
          {hasFilters && (
            <p className="text-xs text-muted-foreground">
              {t("hist.showing")} {sessions.length} {t("common.of")} {sessionTotal} {t("hist.sessions")}
            </p>
          )}
        </div>
      )}

      {/* Trend charts */}
      {sessions.length > 0 && (
        <Suspense fallback={<div className="rounded-2xl border border-border bg-card/40 p-4 text-xs text-muted-foreground">Loading charts...</div>}>
          <LazyHistoryTrendCharts trends={trendData} />
        </Suspense>
      )}

      {/* Session list */}
      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground animate-pulse">
          {t("common.loading")}
        </div>
      ) : sessions.length === 0 && !hasFilters ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center space-y-3">
          <Archive className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-semibold">{t("hist.empty")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("hist.emptyHint")}</p>
          </div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center space-y-3">
          <Filter className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-semibold">{t("hist.noMatch")}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters}>{t("hist.clearFilters")}</Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => {
            const isOpen = openIds.has(s.id);
            const fullAttempts = expandedAttempts[s.id] ?? s.attempts;
            const reportRows = getQuizReportRows(fullAttempts.map((a) => toReportAttempt(a, sessionMaxPts[s.id])));
            const submitted = reportRows.filter((a) => a.completed);
            const attemptPage = attemptPages[s.id] ?? 0;
            const visibleSubmitted = paginate(submitted, attemptPage, HISTORY_PAGE_SIZE);
            const isLoadingExpand = expandingIds.has(s.id);
            const top = submitted[0];
            const teacherName = getTeacherName(profile, user?.email);
            const schoolName = profile?.organization ?? "";
            const quizTypeLabel = QUIZ_TYPE_LABELS[s.topic ?? ""] ?? s.topic ?? "-";
            const avgColor = s.avgPercent >= 70 ? "text-success" : s.avgPercent >= 40 ? "text-warning" : "text-destructive";
            const avgBarColor = s.avgPercent >= 70 ? "bg-success/60" : s.avgPercent >= 40 ? "bg-warning/60" : "bg-destructive/50";
            const avgPct = s.avgPercent;
            const maxScore = submitted.length > 0 ? Math.max(...submitted.map((a) => a.score), 1) : 1;

            return (
              <li key={s.id} className="rounded-2xl border border-border bg-card/60 transition-all hover:border-primary/30 hover:shadow-glow overflow-hidden">

                {/* Collapsed header — full-width tap target */}
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  className="w-full p-5 text-left"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className={`mt-0.5 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display text-base font-bold truncate">{s.title}</span>
                          {s.status === "grading" && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning border border-warning/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0">
                              <Clock className="h-3 w-3" /> Needs Grading
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span>{[s.categoryName, s.subcategoryName].filter(Boolean).join(" → ") || t("hist.uncategorised")}</span>
                          {s.topic && <><span>·</span><span className="text-primary/80">{quizTypeLabel}</span></>}
                          <span>·</span>
                          <span>{new Date(s.created_at).toLocaleDateString()}</span>
                        </div>

                        {/* Avg score bar */}
                        {submitted.length > 0 && (
                          <div className="mt-2.5 flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden max-w-[160px]">
                              <div className={`h-full rounded-full transition-all ${s.status === "grading" ? "bg-warning/50" : avgBarColor} ${
                                avgPct <= 10 ? "w-[10%]" : avgPct <= 20 ? "w-1/5"
                                : avgPct <= 25 ? "w-1/4" : avgPct <= 33 ? "w-1/3"
                                : avgPct <= 50 ? "w-1/2" : avgPct <= 66 ? "w-2/3"
                                : avgPct <= 75 ? "w-3/4" : avgPct <= 90 ? "w-[90%]" : "w-full"
                              }`} />
                            </div>
                            <span className={`text-xs font-bold ${s.status === "grading" ? "text-warning" : avgColor}`}>
                              {s.avgScore} pts
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {s.status === "grading" ? "avg (partial)" : "avg"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right stats */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden sm:flex flex-col items-end gap-1">
                        <span className="text-xs text-muted-foreground">{submitted.length} submitted</span>
                        {top && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                            <Crown className="h-3 w-3" />
                            <span className="truncate max-w-[100px]">{top.name}</span>
                            <span className="text-success font-bold ml-1">{top.score}pts</span>
                          </span>
                        )}
                      </div>
                      {s.status === "grading" ? (
                        <span className="rounded-full px-2.5 py-1 text-xs font-bold border bg-warning/10 text-warning border-warning/25">
                          Pending
                        </span>
                      ) : (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold border ${
                          avgPct >= 70 ? "bg-success/10 text-success border-success/25" :
                          avgPct >= 40 ? "bg-warning/10 text-warning border-warning/25" :
                          submitted.length === 0 ? "bg-muted/20 text-muted-foreground border-border" :
                          "bg-destructive/10 text-destructive border-destructive/25"
                        }`}>
                          {submitted.length === 0 ? "No data" : avgPct >= 70 ? "Good" : avgPct >= 40 ? "Fair" : "Low"}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded panel */}
                {isOpen && (
                  <div className="border-t border-border" id={`history-report-${s.id}`}>
                    {isLoadingExpand && (
                      <div className="p-4 text-xs text-muted-foreground animate-pulse">{t("hist.loadingReport")}</div>
                    )}

                    {/* Report meta + actions */}
                    <div className="p-4 bg-muted/10 flex flex-wrap items-start justify-between gap-3 print:hidden">
                      <div className="space-y-1 min-w-0">
                        <p className="text-xs font-semibold">{t("hist.finalReport")}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span>{t("hist.teacher")}: <span className="text-foreground font-medium">{teacherName}</span></span>
                          {schoolName && <span>{t("hist.school")}: <span className="text-foreground font-medium">{schoolName}</span></span>}
                          <span>{t("hist.type")}: <span className="text-foreground font-medium">{quizTypeLabel}</span></span>
                          <span>{t("hist.subject")}: <span className="text-foreground font-medium">{subjectLabel(s)}</span></span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0 flex-wrap" ref={downloadRef}>
                        {s.status === "grading" && (
                          <Button size="sm" onClick={() => void navigate({ to: "/sessions/$sessionId/grade", params: { sessionId: s.id } })}
                            className="gap-1.5 bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25">
                            <PenLine className="h-3.5 w-3.5" /> Grade Now
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => printQuiz(s, fullAttempts)} className="gap-1.5">
                          <Printer className="h-3.5 w-3.5" /> {t("hist.print")}
                        </Button>
                        <div className="relative">
                          <Button size="sm" onClick={() => setDownloadOpenId((prev) => (prev === s.id ? null : s.id))}
                            className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow">
                            <Download className="h-3.5 w-3.5" /> {t("hist.download")} <ChevronDown className="h-3 w-3 ml-0.5" />
                          </Button>
                          {downloadOpenId === s.id && (
                            <div className="absolute right-0 mt-1 w-40 rounded-xl border border-border bg-card shadow-card z-10 overflow-hidden">
                              <button type="button" className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-sidebar-accent transition-colors"
                                onClick={() => { setDownloadOpenId(null); downloadQuizReportCsv({ title: s.title, categoryLabel: [s.categoryName, s.subcategoryName].filter(Boolean).join(" -> "), teacherName, schoolName, subjectLabel: subjectLabel(s), topicLabel: quizTypeLabel, createdAt: s.created_at, questionCount: fullAttempts[0]?.total_questions ?? 0, attempts: fullAttempts.map((a) => toReportAttempt(a, sessionMaxPts[s.id])) }, { watermark: plan?.file_export_watermark !== false }); }}>
                                <FileSpreadsheet className="h-3.5 w-3.5 text-success" /> Excel (CSV)
                              </button>
                              <button type="button" className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-sidebar-accent transition-colors"
                                onClick={() => { setDownloadOpenId(null); printQuiz(s, fullAttempts); }}>
                                <FileText className="h-3.5 w-3.5 text-primary" /> PDF (Print)
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {submitted.length === 0 ? (
                      <p className="p-4 text-xs text-muted-foreground">{t("hist.noParticipants")}</p>
                    ) : (
                      <div className="p-4 space-y-2">
                        {/* Top-3 podium */}
                        {submitted.length >= 2 && (
                          <div className="grid grid-cols-3 gap-2 mb-4">
                            {submitted.slice(0, 3).map((a, i) => {
                              const medals = [
                                { bg: "bg-yellow-500/15 border-yellow-500/30", text: "text-yellow-600", label: "🥇 1st" },
                                { bg: "bg-slate-400/15 border-slate-400/30", text: "text-slate-500", label: "🥈 2nd" },
                                { bg: "bg-orange-400/15 border-orange-400/30", text: "text-orange-600", label: "🥉 3rd" },
                              ];
                              const m = medals[i] ?? medals[2];
                              return (
                                <div key={a.id} className={`rounded-xl border p-3 text-center ${m.bg}`}>
                                  <div className={`text-[10px] font-bold uppercase tracking-wider ${m.text}`}>{m.label}</div>
                                  <div className="mt-1 text-sm font-bold truncate">{a.name}</div>
                                  <div className={`text-lg font-bold ${m.text}`}>
                                  {a.score}
                                  <span className="text-xs font-normal text-muted-foreground">/{a.totalMaxPoints ?? a.totalQuestions}</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground">{a.percent}% · {a.totalMaxPoints ?? a.totalQuestions} pts total</div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Participant rows */}
                        <ol className="space-y-1.5">
                          {visibleSubmitted.map((a) => {
                            const stats = attemptAnswerStats[s.id]?.[a.id];
                            const attempted = stats?.attempted ?? a.attemptedQuestions;
                            const skipped = Math.max(0, a.totalQuestions - attempted);
                            const scorePct = Math.round((a.score / Math.max(1, maxScore)) * 100);
                            const rankColors = [
                              "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
                              "bg-slate-400/20 text-slate-600 border-slate-400/30",
                              "bg-orange-400/20 text-orange-600 border-orange-400/30",
                            ];
                            const rankClass = a.rank <= 3 ? rankColors[a.rank - 1] : "bg-primary/10 text-primary border-primary/20";

                            return (
                              <li key={a.id} className="rounded-xl bg-secondary/40 hover:bg-secondary/60 px-3 py-2.5 transition-colors">
                                <div className="flex items-center gap-3">
                                  <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${rankClass}`}>
                                    {a.rank}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="font-semibold text-sm truncate">{a.name}</div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <div className={`text-sm font-bold ${s.status === "grading" ? "text-warning" : "text-success"}`}>
                                          {a.score}
                                          <span className="text-[10px] text-muted-foreground font-normal">/{a.totalMaxPoints ?? a.totalQuestions}</span>
                                          <span className="text-[10px] text-muted-foreground font-normal ml-0.5">pts</span>
                                          {s.status === "grading" && (
                                            <span className="text-[10px] text-warning font-medium ml-1">(partial)</span>
                                          )}
                                        </div>
                                        <div className={`text-[10px] font-mono ${s.status === "grading" ? "text-warning/70" : "text-muted-foreground"}`}>
                                          {a.percent}%
                                        </div>
                                      </div>
                                    </div>
                                    {/* Score bar */}
                                    <div className="mt-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                                      <div className={`h-full rounded-full bg-success/60 transition-all ${
                                        scorePct <= 10 ? "w-[10%]" : scorePct <= 20 ? "w-1/5"
                                        : scorePct <= 25 ? "w-1/4" : scorePct <= 33 ? "w-1/3"
                                        : scorePct <= 50 ? "w-1/2" : scorePct <= 66 ? "w-2/3"
                                        : scorePct <= 75 ? "w-3/4" : scorePct <= 90 ? "w-[90%]" : "w-full"
                                      }`} />
                                    </div>
                                    {/* Pills row */}
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                      <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.status === "grading" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                                        {a.score}/{a.totalMaxPoints ?? a.totalQuestions} pts · {a.percent}%{s.status === "grading" ? " (partial)" : ""}
                                      </span>
                                      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted/40 text-muted-foreground px-2 py-0.5 text-[10px] font-semibold">{attempted}/{a.totalQuestions} attempted</span>
                                      {skipped > 0 && <span className="inline-flex items-center gap-0.5 rounded-full bg-muted/40 text-muted-foreground px-2 py-0.5 text-[10px] font-semibold">— {skipped} skipped</span>}
                                      {a.email && <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{a.email}</span>}
                                      {a.rollNumber && <span className="text-[10px] text-muted-foreground">{t("hist.rollN")} {a.rollNumber}</span>}
                                    </div>
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                        <PaginationControls
                          page={attemptPage}
                          pageSize={HISTORY_PAGE_SIZE}
                          total={submitted.length}
                          label="participants"
                          onPageChange={(nextPage) => setAttemptPages((current) => ({ ...current, [s.id]: nextPage }))}
                        />
                      </div>
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

function toReportAttempt(a: AttemptRow, totalMaxPoints?: number | null): QuizReportAttempt {
  const meta =
    a.participants?.metadata && typeof a.participants.metadata === "object"
      ? (a.participants.metadata as Record<string, unknown>)
      : {};
  const attemptedQuestions = a.completed ? a.total_questions : 0;
  const unattemptedQuestions = a.completed ? 0 : a.total_questions;
  return {
    id: a.id,
    name: a.participant_name ?? "Anonymous",
    email: a.participant_email,
    rollNumber: stringMeta(meta.roll_number),
    seatNumber: stringMeta(meta.seat_number),
    score: a.score,
    totalQuestions: a.total_questions,
    totalMaxPoints: totalMaxPoints ?? null,
    attemptedQuestions,
    correctAnswers: 0,
    wrongAnswers: 0,
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
