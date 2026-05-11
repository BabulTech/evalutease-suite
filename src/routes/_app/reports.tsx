import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  BarChart3,
  CalendarRange,
  Download,
  FileText,
  Filter,
  Flame,
  ListFilter,
  RotateCcw,
  Search,
  Target,
  Timer,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  downloadQuizReportCsv,
  formatDuration,
  getQuizReportRows,
  type QuizReportAttempt,
  type QuizReportRow,
} from "@/lib/quiz-reports";
import { PaginationControls } from "@/components/PaginationControls";
import { paginate } from "@/lib/pagination";

export const Route = createFileRoute("/_app/reports")({ component: ReportsPage });

const REPORT_PAGE_SIZE = 25;
const LazyQuizReportVisualization = lazy(
  () => import("@/components/reports/QuizReportVisualization"),
);

type SessionRow = {
  id: string;
  title: string;
  created_at: string;
  category_id: string | null;
  subcategory_id: string | null;
  subject: string | null;
  topic: string | null;
  description: string | null;
};

type AttemptRow = {
  id: string;
  participant_name: string | null;
  participant_email: string | null;
  score: number;
  total_questions: number;
  completed: boolean;
  started_at: string | null;
  completed_at: string | null;
  participants: { metadata: unknown } | null;
};

type ReportSession = SessionRow & {
  categoryName: string;
  subcategoryName: string;
};

type ProfileRow = {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  organization: string | null;
};

type ReportMode = "quiz" | "student";
type StudentMode = "attempts" | "students";
type DateRange = "all" | "7d" | "30d" | "90d";
type StatusFilter = "all" | "completed" | "pending";
type SortOption = "rank" | "percentDesc" | "percentAsc" | "name" | "fastest" | "recent";

const DATE_RANGE_KEYS: Record<DateRange, string> = {
  all: "rep.allTime",
  "7d": "rep.last7d",
  "30d": "rep.last30d",
  "90d": "rep.last90d",
};

const SORT_KEYS: Record<SortOption, string> = {
  rank: "rep.positionBestFirst",
  percentDesc: "rep.scoreHighLow",
  percentAsc: "rep.scoreLowHigh",
  name: "rep.nameAZ",
  fastest: "rep.fastest",
  recent: "rep.mostRecent",
};

function ReportsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
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
      .select("id, title, created_at, category_id, subcategory_id, subject, topic, description", { count: "exact" })
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

    const subIds = Array.from(new Set(rows.map((r) => r.subcategory_id).filter(Boolean))) as string[];
    const catIds = Array.from(new Set(rows.map((r) => r.category_id).filter(Boolean))) as string[];

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
      categoryName: row.category_id ? catNames.get(row.category_id) ?? "" : "",
      subcategoryName: row.subcategory_id ? subNames.get(row.subcategory_id) ?? "" : "",
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

  // title + dateRange are filtered server-side in load(); only subjectFilter is client-side here
  const filteredSessions = useMemo(() => {
    if (subjectFilter === "all") return sessions;
    return sessions.filter((s) => subjectLabel(s) === subjectFilter);
  }, [sessions, subjectFilter]);

  // sessions is already the current server-side page - no further slicing needed
  const visibleSessions = filteredSessions;

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
      setAttemptsLoading(true);
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select(
          "id, participant_name, participant_email, score, total_questions, completed, started_at, completed_at, participants ( metadata )",
        )
        .eq("session_id", selectedId)
        .order("score", { ascending: false });
      setAttemptsLoading(false);
      if (error) {
        toast.error(error.message);
        setSelectedAttempts([]);
        return;
      }
      setSelectedAttempts(((data ?? []) as AttemptRow[]).map(toReportAttempt));
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
        statusFilter === "all" ||
        (statusFilter === "completed" ? row.completed : !row.completed);
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

  const studentAttemptRows = useMemo(() => {
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
        statusFilter === "all" ||
        (statusFilter === "completed" ? row.completed : !row.completed);
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
      const sessionIds = filteredSessions.map((session) => session.id);
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
      const grouped: Record<string, QuizReportAttempt[]> = {};
      for (const sessionId of sessionIds) grouped[sessionId] = [];
      for (const attempt of (data ?? []) as (AttemptRow & { session_id: string })[]) {
        grouped[attempt.session_id].push(toReportAttempt(attempt));
      }
      setStudentAttempts(grouped);
    };
    void loadStudentModeAttempts();
  }, [reportMode, filteredSessions]);

  const studentSummaryRows = useMemo(
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

  const exportCsv = () => {
    if (!selected) return;
    downloadQuizReportCsv(
      {
        title: selected.title,
        categoryLabel: categoryLabel(selected),
        teacherName,
        schoolName,
        subjectLabel: subjectLabel(selected),
        topicLabel: selected.topic ?? "",
        createdAt: selected.created_at,
        questionCount: selectedAttempts[0]?.totalQuestions ?? 0,
        attempts: selectedAttempts,
      },
      { rows: filteredRows, filterSummary },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" /> {t("rep.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("rep.desc")}</p>
        </div>
        {selected && reportMode === "quiz" && (
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" onClick={() => window.print()} className="gap-1.5">
              <FileText className="h-4 w-4" /> PDF
            </Button>
            <Button
              onClick={exportCsv}
              className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow"
            >
              <Download className="h-4 w-4" /> Excel ({filteredRows.length})
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
          <Trophy className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">{t("rep.empty")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("rep.emptyHint")}</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-3 print:hidden">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={reportMode === "quiz" ? "default" : "outline"}
                onClick={() => setReportMode("quiz")}
                className={
                  reportMode === "quiz"
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : ""
                }
              >
                <BarChart3 className="mr-1.5 h-4 w-4" /> {t("rep.quiz")}
              </Button>
              <Button
                type="button"
                variant={reportMode === "student" ? "default" : "outline"}
                onClick={() => setReportMode("student")}
                className={
                  reportMode === "student"
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : ""
                }
              >
                <UserRound className="mr-1.5 h-4 w-4" /> {t("rep.student")}
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-card/40 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Filter className="h-3.5 w-3.5" /> {t("rep.filters")}
                </div>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-[11px] inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" /> {t("rep.reset")}
                </button>
              </div>

              <FilterField icon={Search} label={t("rep.searchQuizzes")} hint={t("rep.searchQuizzesHint")}>
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("rep.searchQuizzesPlaceholder")}
                  className="h-9"
                />
              </FilterField>

              <FilterField icon={CalendarRange} label={t("rep.dateRange")} hint={t("rep.dateRangeHint")}>
                <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DATE_RANGE_KEYS) as DateRange[]).map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(DATE_RANGE_KEYS[value])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField icon={ListFilter} label={t("rep.subjectFilter")} hint={t("rep.subjectHint")}>
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t("rep.allSubjects")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("rep.allSubjects")}</SelectItem>
                    {subjectOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField icon={Target} label={`${t("rep.passMark")} - ${passMark}%`} hint={t("rep.passMarkHint")}>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={0} max={100} step={5} value={passMark}
                    onChange={(e) => setPassMark(Number(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-xs font-bold text-primary w-9 text-right">{passMark}%</span>
                </div>
              </FilterField>

              <FilterField icon={Search} label={reportMode === "quiz" ? t("rep.findParticipant") : t("rep.searchStudent")} hint={reportMode === "quiz" ? t("rep.findParticipantHint") : t("rep.searchStudentHint")}>
                <Input
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder={reportMode === "quiz" ? t("rep.findParticipantPlaceholder") : t("rep.searchStudentPlaceholder")}
                  className="h-9"
                />
              </FilterField>

              <FilterField icon={Flame} label={t("rep.submissionStatus")} hint={t("rep.submissionStatusHint")}>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { val: "all", key: "rep.all" },
                    { val: "completed", key: "rep.submittedStatus" },
                    { val: "pending", key: "rep.leftEarly" },
                  ] as const).map(({ val, key }) => (
                    <Button key={val} type="button" size="sm"
                      variant={statusFilter === val ? "default" : "outline"}
                      onClick={() => setStatusFilter(val)}
                      className={statusFilter === val ? "bg-primary text-primary-foreground text-xs" : "text-xs"}>
                      {t(key)}
                    </Button>
                  ))}
                </div>
              </FilterField>

              <FilterField icon={ArrowDownAZ} label={t("rep.sortBy")} hint={t("rep.sortByHint")}>
                <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SORT_KEYS) as SortOption[]).map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(SORT_KEYS[value])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              {reportMode === "student" && (
                <FilterField icon={UserRound} label={t("rep.studentView")}>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={studentMode === "attempts" ? "default" : "outline"}
                      onClick={() => setStudentMode("attempts")}
                      className={
                        studentMode === "attempts" ? "bg-primary text-primary-foreground" : ""
                      }
                    >
                      {t("rep.perAttempt")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={studentMode === "students" ? "default" : "outline"}
                      onClick={() => setStudentMode("students")}
                      className={
                        studentMode === "students" ? "bg-primary text-primary-foreground" : ""
                      }
                    >
                      {t("rep.perStudent")}
                    </Button>
                  </div>
                </FilterField>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
              <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/50">
                {filteredSessions.length} {filteredSessions.length === 1 ? t("rep.quizCount") : t("rep.quizzesCount")}
              </div>
              {filteredSessions.length === 0 ? (
                <div className="px-4 py-6 text-xs text-muted-foreground text-center">
                  {t("rep.noQuizzesMatch")}
                </div>
              ) : (
                visibleSessions.map((s) => {
                  const active = selected?.id === s.id;
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={`block w-full px-4 py-3 text-left border-b border-border/60 last:border-b-0 hover:bg-muted/30 ${
                        active ? "bg-primary/10" : ""
                      }`}
                    >
                      <div className="font-semibold truncate">{s.title}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground truncate">
                        {categoryLabel(s) || t("hist.uncategorised")}
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString()}
                      </div>
                    </button>
                  );
                })
              )}
              <PaginationControls
                page={quizListPage}
                pageSize={REPORT_PAGE_SIZE}
                total={subjectFilter !== "all" ? filteredSessions.length : sessionTotal}
                label="quizzes"
                onPageChange={setQuizListPage}
              />
            </div>
          </aside>

          {reportMode === "student" ? (
            <StudentReportsView
              attemptRows={studentAttemptRows}
              summaryRows={studentSummaryRows}
              mode={studentMode}
              passMark={passMark}
            />
          ) : selected ? (
            <main className="space-y-6" id="report-print-area">
              {attemptsLoading && (
                <div className="rounded-2xl border border-border bg-card/40 p-4 text-sm text-muted-foreground">
                  {t("rep.loadingAttempts")}
                </div>
              )}
              <Suspense
                fallback={
                  <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
                    {t("rep.loadingViz")}
                  </div>
                }
              >
                <LazyQuizReportVisualization
                  session={selected}
                  top={filteredRows[0] ?? baseRows[0]}
                  filteredRows={filteredRows}
                  stats={stats}
                  passMark={passMark}
                  teacherName={teacherName}
                  schoolName={schoolName}
                />
              </Suspense>

              {/* ── Section 6: Full results table ── */}
              <SectionLabel
                title={t("rep.fullResultsTable")}
                desc={t("rep.fullResultsDesc")}
              />
              <AttemptsTable rows={filteredRows} passMark={passMark} />
            </main>
          ) : (
            <main className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
              <Filter className="mx-auto h-10 w-10 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium">{t("rep.noQuizzesMatch")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("rep.loosenFilters")}
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> {t("rep.resetFilters")}
              </Button>
            </main>
          )}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 pt-1">
      <div className="h-6 w-1 rounded-full bg-primary mt-0.5 shrink-0" />
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </div>
  );
}

function FilterField({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: typeof Users;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
        <Icon className="h-3.5 w-3.5 text-primary/70" /> {label}
      </div>
      {hint && <p className="text-[10px] text-muted-foreground -mt-0.5 pl-5">{hint}</p>}
      {children}
    </div>
  );
}

function QuizReportHeader({
  session,
  top,
  teacherName,
  schoolName,
}: {
  session: ReportSession;
  top: QuizReportRow | undefined;
  teacherName: string;
  schoolName: string;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card/60 to-card/40 p-6 print:border-0 print:bg-transparent print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Trophy className="h-3 w-3" /> {t("rep.finalReport")}
          </div>
          <h2 className="font-display text-2xl font-bold leading-tight">{session.title}</h2>
          <p className="text-xs text-muted-foreground">
            {t("rep.heldOn")} {new Date(session.created_at).toLocaleString()} {categoryLabel(session) ? `· ${categoryLabel(session)}` : ""}
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 md:grid-cols-4">
            <ReportDetail label={t("rep.teacherLabel")} value={teacherName} />
            <ReportDetail label={t("rep.schoolOrg")} value={schoolName || t("rep.notSpecified")} />
            <ReportDetail label={t("rep.subjectLabel")} value={subjectLabel(session)} />
            <ReportDetail label={t("rep.topicLabel")} value={session.topic || t("rep.notSpecified")} />
          </dl>
        </div>
        {top && (
          <div className="rounded-2xl border border-warning/30 bg-warning/5 px-5 py-4 text-center shrink-0">
            <div className="text-2xl">🥇</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{t("rep.topScorer")}</div>
            <div className="font-display font-bold text-base mt-0.5 max-w-[140px] truncate">{top.name}</div>
            <div className="text-success font-bold text-sm">{top.score} pts · {top.percent}%</div>
          </div>
        )}
      </div>
    </div>
  );
}

function AttemptsTable({ rows, passMark }: { rows: QuizReportRow[]; passMark: number }) {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const [answerStats, setAnswerStats] = useState<
    Record<string, { correct: number; wrong: number; attempted: number }>
  >({});
  const visibleRows = paginate(rows, page, REPORT_PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [rows]);

  useEffect(() => {
    const attemptIds = visibleRows.map((row) => row.id);
    if (attemptIds.length === 0) return;
    const loadStats = async () => {
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
      setAnswerStats(next);
    };
    void loadStats();
  }, [visibleRows]);

  return (
    <div className="rounded-2xl border border-border bg-card/40 overflow-x-auto">
      {rows.length === 0 ? (
        <div className="p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium">{t("rep.noParticipantsMatch")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("rep.tryChangingFilters")}</p>
        </div>
      ) : (
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t("rep.colHash")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t("rep.colParticipant")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t("rep.colRollSeat")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t("rep.colScorePts")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t("rep.colScorePct")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t("rep.colResult")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-success/80">{t("rep.colCorrect")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-destructive/80">{t("rep.colWrong")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t("rep.colSkipped")}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{t("rep.colTimeTaken")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {visibleRows.map((row) => {
              const stats = answerStats[row.id];
              const correct = stats?.correct ?? row.correctAnswers;
              const wrong = stats?.wrong ?? row.wrongAnswers;
              const attempted = stats?.attempted ?? row.attemptedQuestions;
              const skipped = Math.max(0, row.totalQuestions - attempted);
              return (
              <tr key={row.id} className="hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3 font-bold text-muted-foreground">{row.rank}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold">{row.name}</div>
                  <div className="text-xs text-muted-foreground">{row.email || t("rep.noEmail")}</div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {row.rollNumber ? <span>Roll: {row.rollNumber}</span> : null}
                  {row.rollNumber && row.seatNumber ? " · " : null}
                  {row.seatNumber ? <span>Seat: {row.seatNumber}</span> : null}
                  {!row.rollNumber && !row.seatNumber ? "-" : null}
                </td>
                <td className="px-4 py-3 font-bold text-success">{row.score}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{row.percent}%</span>
                    <div className="w-16 h-1.5 rounded-full bg-muted/30 hidden sm:block">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${row.percent}%`, background: row.percent >= passMark ? "#34d399" : "#f87171" }} />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><ResultBadge row={row} passMark={passMark} /></td>
                <td className="px-4 py-3 font-semibold text-success">{correct}</td>
                <td className="px-4 py-3 font-semibold text-destructive">{wrong}</td>
                <td className="px-4 py-3 text-muted-foreground">{skipped}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDuration(row.durationSeconds ?? null)}</td>
              </tr>
            )})}
          </tbody>
        </table>
      )}
      <div className="px-4 py-2 border-t border-border/40 text-xs text-muted-foreground">
        {rows.length} {rows.length !== 1 ? t("rep.participantsMatched") : t("rep.participantMatched")}
      </div>
      <PaginationControls
        page={page}
        pageSize={REPORT_PAGE_SIZE}
        total={rows.length}
        label="participants"
        onPageChange={setPage}
      />
    </div>
  );
}

function ResultBadge({ row, passMark }: { row: QuizReportRow; passMark: number }) {
  const { t } = useI18n();
  if (!row.completed) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {t("rep.resultLeft")}
      </span>
    );
  }
  const passed = row.percent >= passMark;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        passed
          ? "bg-success/15 text-success border border-success/30"
          : "bg-destructive/15 text-destructive border border-destructive/30"
      }`}
    >
      {passed ? t("rep.resultPass") : t("rep.resultFail")}
    </span>
  );
}

function DistributionBar({
  buckets,
  passMark,
}: {
  buckets: { top: number; pass: number; fail: number; left: number };
  passMark: number;
}) {
  const total = buckets.top + buckets.pass + buckets.fail + buckets.left;
  if (total === 0) return null;
  const pct = (n: number) => (n / total) * 100;
  const topThreshold = Math.min(100, passMark + 25);
  const { t } = useI18n();

  const bands = [
    { dot: "bg-success", label: `${t("rep.excellent")} (≥ ${topThreshold}%)`, desc: t("rep.scoredTopBand"), value: buckets.top },
    { dot: "bg-primary/80", label: `${t("rep.passedBand")} (${passMark}–${topThreshold - 1}%)`, desc: t("rep.metPassMark"), value: buckets.pass },
    { dot: "bg-destructive/80", label: `${t("rep.belowPass")} (< ${passMark}%)`, desc: t("rep.didNotMeetPassMark"), value: buckets.fail },
    { dot: "bg-muted-foreground/40", label: t("rep.didNotFinish"), desc: t("rep.leftWithoutSubmitting"), value: buckets.left },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
      {/* Bar */}
      <div className="h-4 w-full overflow-hidden rounded-full bg-muted/30 flex gap-0.5">
        {bands.map((b) => pct(b.value) > 0 && (
          <div key={b.label} className={`h-full ${b.dot} first:rounded-l-full last:rounded-r-full transition-all`}
            style={{ width: `${pct(b.value)}%` }} title={`${b.label}: ${b.value}`} />
        ))}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {bands.map((b) => (
          <div key={b.label} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${b.dot}`} />
              <span className="text-xs font-semibold">{b.value}</span>
              <span className="text-xs text-muted-foreground">({Math.round(pct(b.value))}%)</span>
            </div>
            <div className="text-[11px] font-medium pl-4 leading-tight">{b.label}</div>
            <div className="text-[10px] text-muted-foreground pl-4">{b.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-semibold">{value}</span>
    </div>
  );
}

function ReportDetail({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold text-foreground">{value || t("rep.notSpecified")}</dd>
    </div>
  );
}

type StudentAttemptRow = QuizReportRow & {
  sessionId: string;
  sessionTitle: string;
  sessionCategory: string;
  sessionCreatedAt: string;
};

type StudentSummaryRow = {
  key: string;
  name: string;
  email: string | null;
  attempts: number;
  submitted: number;
  avgPercent: number;
  bestPercent: number;
  worstPercent: number;
  totalPoints: number;
  lastAttemptAt: string | null;
};

function StudentReportsView({
  attemptRows,
  summaryRows,
  mode,
  passMark,
}: {
  attemptRows: StudentAttemptRow[];
  summaryRows: StudentSummaryRow[];
  mode: StudentMode;
  passMark: number;
}) {
  const completed = attemptRows.filter((row) => row.completed).length;
  const average =
    attemptRows.length === 0
      ? 0
      : Math.round(attemptRows.reduce((sum, row) => sum + row.percent, 0) / attemptRows.length);
  const passed = attemptRows.filter((row) => row.completed && row.percent >= passMark).length;
  const passRate =
    attemptRows.length === 0 ? 0 : Math.round((passed / attemptRows.length) * 100);
  const uniqueStudents = summaryRows.length;
  const { t } = useI18n();

  return (
    <main className="space-y-5">
      <div className="rounded-2xl border border-border bg-card/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {t("rep.studentReport")}
            </div>
            <h2 className="font-display text-2xl font-bold">
              {mode === "students" ? t("rep.allStudents") : t("rep.allStudentAttempts")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {mode === "students" ? t("rep.oneRowPerStudent") : t("rep.everyAttempt")}
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-bold">
              {mode === "students" ? uniqueStudents : attemptRows.length}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {mode === "students" ? t("rep.students") : t("rep.matchingAttempts")}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Metric icon={Users} label={t("rep.uniqueStudents")} value={uniqueStudents} desc={t("rep.uniqueStudentsDesc")} />
        <Metric icon={BarChart3} label={t("rep.totalAttempts")} value={attemptRows.length} desc={t("rep.totalAttemptsDesc")} />
        <Metric icon={Trophy} label={t("rep.submittedAttempts")} value={completed} desc={t("rep.submittedAttemptsDesc")} />
        <Metric icon={Target} label={t("rep.passRate")} value={`${passRate}%`} desc={`% of attempts scoring ≥ ${passMark}%`} color={passRate >= 60 ? "text-success" : "text-destructive"} />
      </div>

      {mode === "students" ? (
        <StudentSummaryTable rows={summaryRows} passMark={passMark} />
      ) : (
        <StudentAttemptsTable rows={attemptRows} passMark={passMark} average={average} />
      )}
    </main>
  );
}

function StudentSummaryTable({
  rows,
  passMark,
}: {
  rows: StudentSummaryRow[];
  passMark: number;
}) {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const visibleRows = paginate(rows, page, REPORT_PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [rows]);

  return (
    <div className="rounded-2xl border border-border bg-card/40 overflow-x-auto">
      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          {t("rep.noStudentsMatch")}
        </div>
      ) : (
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-secondary/40">
            <tr>
              {[
                t("rep.colStudent"),
                t("rep.colEmail"),
                t("rep.colAttempts"),
                t("rep.colSubmitted"),
                t("rep.colAvgPct"),
                t("rep.colBestPct"),
                t("rep.colWorstPct"),
                t("rep.colPoints"),
                t("rep.colLastAttempt"),
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const passing = row.avgPercent >= passMark;
              return (
                <tr key={row.key} className="border-t border-border/50">
                  <td className="px-3 py-2 font-semibold">{row.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.email || "-"}</td>
                  <td className="px-3 py-2">{row.attempts}</td>
                  <td className="px-3 py-2">{row.submitted}</td>
                  <td
                    className={`px-3 py-2 font-bold ${
                      passing ? "text-success" : "text-destructive"
                    }`}
                  >
                    {row.avgPercent}%
                  </td>
                  <td className="px-3 py-2 text-success font-semibold">{row.bestPercent}%</td>
                  <td className="px-3 py-2 text-destructive font-semibold">{row.worstPercent}%</td>
                  <td className="px-3 py-2">{row.totalPoints}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.lastAttemptAt
                      ? new Date(row.lastAttemptAt).toLocaleDateString()
                      : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <PaginationControls
        page={page}
        pageSize={REPORT_PAGE_SIZE}
        total={rows.length}
        label="students"
        onPageChange={setPage}
      />
    </div>
  );
}

function StudentAttemptsTable({
  rows,
  passMark,
  average,
}: {
  rows: StudentAttemptRow[];
  passMark: number;
  average: number;
}) {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const visibleRows = paginate(rows, page, REPORT_PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [rows]);

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <Metric icon={BarChart3} label={t("rep.averageScore")} value={`${average}%`} desc={t("rep.averageScoreDesc")} color={average >= passMark ? "text-success" : "text-destructive"} />
        <Metric icon={Trophy} label={t("rep.highestScore")} value={`${rows[0]?.percent ?? 0}%`} desc={t("rep.highestScoreDesc")} color="text-success" />
        <Metric
          icon={Timer} label={t("rep.averageTime")} desc={t("rep.averageTimeDesc")}
          value={
            rows.length === 0 ? "-"
              : formatDuration(
                  rows.reduce((sum, r) => sum + (r.durationSeconds ?? 0), 0) /
                    Math.max(1, rows.filter((r) => r.durationSeconds).length),
                )
          }
        />
      </div>

      <div className="rounded-2xl border border-border bg-card/40 overflow-x-auto">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {t("rep.noAttemptsMatch")}
          </div>
        ) : (
          <table className="w-full text-sm min-w-[920px]">
            <thead className="bg-secondary/40">
              <tr>
                {[
                  t("rep.colStudent"),
                  t("rep.colEmail"),
                  t("rep.colQuiz"),
                  t("rep.colRoll"),
                  t("rep.colSeat"),
                  t("rep.colPoints"),
                  "%",
                  t("rep.colResult"),
                  t("rep.colCorrect"),
                  t("rep.colWrong"),
                  t("rep.colTime"),
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={`${row.sessionId}-${row.id}`} className="border-t border-border/50">
                  <td className="px-3 py-2 font-semibold">{row.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.email || "-"}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.sessionTitle}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.sessionCategory || new Date(row.sessionCreatedAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-3 py-2">{row.rollNumber || "-"}</td>
                  <td className="px-3 py-2">{row.seatNumber || "-"}</td>
                  <td className="px-3 py-2 font-bold text-success">{row.score}</td>
                  <td className="px-3 py-2 font-mono">{row.percent}%</td>
                  <td className="px-3 py-2">
                    <ResultBadge row={row} passMark={passMark} />
                  </td>
                  <td className="px-3 py-2 text-success font-semibold">{row.correctAnswers}</td>
                  <td className="px-3 py-2 text-destructive font-semibold">{row.wrongAnswers}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDuration(row.durationSeconds ?? null)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <PaginationControls
          page={page}
          pageSize={REPORT_PAGE_SIZE}
          total={rows.length}
          label="attempts"
          onPageChange={setPage}
        />
      </div>
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  desc,
  color = "text-foreground",
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  desc?: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-2 hover:border-primary/30 hover:shadow-glow transition-all duration-200">
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4 text-primary/70" />
      </div>
      <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</div>}
      </div>
    </div>
  );
}

function AnswerMetric({
  label,
  value,
  tone,
  desc,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "muted";
  desc?: string;
}) {
  const color = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-muted-foreground";
  const border = tone === "success" ? "border-success/20" : tone === "danger" ? "border-destructive/20" : "border-border";
  const bg = tone === "success" ? "bg-success/5" : tone === "danger" ? "bg-destructive/5" : "bg-card/50";
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-4 space-y-1`}>
      <div className={`font-display text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-sm font-medium">{label}</div>
      {desc && <div className="text-[11px] text-muted-foreground leading-snug">{desc}</div>}
    </div>
  );
}

function categoryLabel(s: Pick<ReportSession, "categoryName" | "subcategoryName">) {
  return [s.categoryName, s.subcategoryName].filter(Boolean).join(" → ");
}

function subjectLabel(s: Pick<ReportSession, "subject" | "categoryName" | "subcategoryName">) {
  return s.subject || categoryLabel(s) || "Not specified";
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
  const startedAt = a.started_at ?? null;
  const completedAt = a.completed_at ?? null;
  const durationSeconds =
    startedAt && completedAt
      ? Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000))
      : null;
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
    startedAt,
    completedAt,
    durationSeconds,
  };
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

function sortRows<T extends QuizReportRow>(rows: T[], sort: SortOption): T[] {
  const sorted = rows.slice();
  switch (sort) {
    case "rank":
      sorted.sort((a, b) => a.rank - b.rank);
      break;
    case "percentDesc":
      sorted.sort((a, b) => b.percent - a.percent || a.rank - b.rank);
      break;
    case "percentAsc":
      sorted.sort((a, b) => a.percent - b.percent || a.rank - b.rank);
      break;
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "fastest":
      sorted.sort((a, b) => {
        const da = a.durationSeconds ?? Number.POSITIVE_INFINITY;
        const db = b.durationSeconds ?? Number.POSITIVE_INFINITY;
        return da - db;
      });
      break;
    case "recent":
      sorted.sort((a, b) => {
        const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return tb - ta;
      });
      break;
  }
  return sorted;
}

function computeQuizStats(rows: QuizReportRow[], passMark: number) {
  const submittedRows = rows.filter((r) => r.completed);
  const total = rows.length;
  const submitted = submittedRows.length;
  const percents = submittedRows.map((r) => r.percent);
  const avg =
    percents.length === 0
      ? 0
      : Math.round(percents.reduce((sum, n) => sum + n, 0) / percents.length);
  const sortedPercents = percents.slice().sort((a, b) => a - b);
  const median =
    sortedPercents.length === 0
      ? null
      : sortedPercents.length % 2
        ? sortedPercents[(sortedPercents.length - 1) / 2]
        : Math.round(
            (sortedPercents[sortedPercents.length / 2 - 1] +
              sortedPercents[sortedPercents.length / 2]) /
              2,
          );
  const best = percents.length === 0 ? null : Math.max(...percents);
  const worst = percents.length === 0 ? null : Math.min(...percents);
  const passed = submittedRows.filter((r) => r.percent >= passMark).length;
  const passRate = total === 0 ? 0 : Math.round((passed / total) * 100);

  const durations = submittedRows
    .map((r) => r.durationSeconds)
    .filter((d): d is number => typeof d === "number" && d > 0);
  const avgDuration =
    durations.length === 0
      ? null
      : Math.round(durations.reduce((sum, n) => sum + n, 0) / durations.length);

  const topThreshold = Math.min(100, passMark + 25);
  const buckets = rows.reduce(
    (acc, row) => {
      if (!row.completed) acc.left += 1;
      else if (row.percent >= topThreshold) acc.top += 1;
      else if (row.percent >= passMark) acc.pass += 1;
      else acc.fail += 1;
      return acc;
    },
    { top: 0, pass: 0, fail: 0, left: 0 },
  );

  const totals = rows.reduce(
    (sum, row) => ({
      correct: sum.correct + row.correctAnswers,
      wrong: sum.wrong + row.wrongAnswers,
      unattempted: sum.unattempted + row.unattemptedQuestions,
    }),
    { correct: 0, wrong: 0, unattempted: 0 },
  );

  return { total, submitted, avg, median, best, worst, passRate, avgDuration, buckets, totals };
}

function aggregateByStudent(rows: StudentAttemptRow[]): StudentSummaryRow[] {
  const map = new Map<string, StudentSummaryRow & { _percents: number[] }>();
  for (const row of rows) {
    const key = (row.email?.toLowerCase() || row.name || "").trim() || row.id;
    const existing = map.get(key);
    if (existing) {
      existing.attempts += 1;
      if (row.completed) existing.submitted += 1;
      existing._percents.push(row.percent);
      existing.bestPercent = Math.max(existing.bestPercent, row.percent);
      existing.worstPercent = Math.min(existing.worstPercent, row.percent);
      existing.totalPoints += row.score;
      const last = row.completedAt ?? row.sessionCreatedAt;
      if (
        last &&
        (!existing.lastAttemptAt || new Date(last) > new Date(existing.lastAttemptAt))
      ) {
        existing.lastAttemptAt = last;
      }
    } else {
      map.set(key, {
        key,
        name: row.name,
        email: row.email,
        attempts: 1,
        submitted: row.completed ? 1 : 0,
        _percents: [row.percent],
        bestPercent: row.percent,
        worstPercent: row.percent,
        totalPoints: row.score,
        avgPercent: 0,
        lastAttemptAt: row.completedAt ?? row.sessionCreatedAt,
      });
    }
  }
  return Array.from(map.values())
    .map(({ _percents, ...rest }) => ({
      ...rest,
      avgPercent: Math.round(_percents.reduce((sum, n) => sum + n, 0) / _percents.length),
    }))
    .sort((a, b) => b.avgPercent - a.avgPercent || a.name.localeCompare(b.name));
}

function buildFilterSummary(args: {
  dateRange: DateRange;
  subjectFilter: string;
  statusFilter: StatusFilter;
  passMark: number;
  studentQuery: string;
  sort: SortOption;
}) {
  const parts: string[] = [];
  if (args.dateRange !== "all") parts.push(DATE_RANGE_LABEL[args.dateRange]);
  if (args.subjectFilter !== "all") parts.push(`Subject: ${args.subjectFilter}`);
  if (args.statusFilter !== "all") parts.push(`Status: ${args.statusFilter}`);
  parts.push(`Pass mark: ${args.passMark}%`);
  if (args.studentQuery.trim()) parts.push(`Search: ${args.studentQuery.trim()}`);
  if (args.sort !== "rank") parts.push(`Sort: ${SORT_LABEL[args.sort]}`);
  return parts.join(" · ");
}
