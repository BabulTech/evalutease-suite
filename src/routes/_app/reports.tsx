import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

export const Route = createFileRoute("/_app/reports")({ component: ReportsPage });

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
  session_id: string;
  participant_name: string | null;
  participant_email: string | null;
  score: number;
  total_questions: number;
  completed: boolean;
  started_at: string | null;
  completed_at: string | null;
  quiz_answers: { id: string; is_correct: boolean | null }[] | null;
  participants: { metadata: unknown } | null;
};

type ReportSession = SessionRow & {
  categoryName: string;
  subcategoryName: string;
  attempts: QuizReportAttempt[];
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

const DATE_RANGE_LABEL: Record<DateRange, string> = {
  all: "All time",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

const SORT_LABEL: Record<SortOption, string> = {
  rank: "Position (best first)",
  percentDesc: "Score % (high → low)",
  percentAsc: "Score % (low → high)",
  name: "Name (A → Z)",
  fastest: "Fastest finish",
  recent: "Most recent",
};

function ReportsPage() {
  const { user } = useAuth();
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

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("quiz_sessions")
      .select("id, title, created_at, category_id, subcategory_id, subject, topic, description")
      .eq("owner_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    const rows = (data ?? []) as SessionRow[];
    if (rows.length === 0) {
      setSessions([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }

    const sessionIds = rows.map((r) => r.id);
    const subIds = Array.from(new Set(rows.map((r) => r.subcategory_id).filter(Boolean))) as string[];
    const catIds = Array.from(new Set(rows.map((r) => r.category_id).filter(Boolean))) as string[];

    const [attemptsRes, subRes, catRes, profileRes] = await Promise.all([
      supabase
        .from("quiz_attempts")
        .select(
          "id, session_id, participant_name, participant_email, score, total_questions, completed, started_at, completed_at, quiz_answers ( id, is_correct ), participants ( metadata )",
        )
        .in("session_id", sessionIds),
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
    if (attemptsRes.error) {
      toast.error(attemptsRes.error.message);
      return;
    }
    if (profileRes.data) setProfile(profileRes.data as ProfileRow);

    const subNames = new Map((subRes.data ?? []).map((s) => [s.id, s.name]));
    const catNames = new Map((catRes.data ?? []).map((c) => [c.id, c.name]));
    const attemptsBySession = new Map<string, QuizReportAttempt[]>();
    for (const attempt of (attemptsRes.data ?? []) as AttemptRow[]) {
      const list = attemptsBySession.get(attempt.session_id) ?? [];
      list.push(toReportAttempt(attempt));
      attemptsBySession.set(attempt.session_id, list);
    }

    const next = rows.map((row) => ({
      ...row,
      categoryName: row.category_id ? catNames.get(row.category_id) ?? "" : "",
      subcategoryName: row.subcategory_id ? subNames.get(row.subcategory_id) ?? "" : "",
      attempts: attemptsBySession.get(row.id) ?? [],
    }));
    setSessions(next);
    setSelectedId((current) => current ?? next[0]?.id ?? null);
  }, [user]);

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

  const dateCutoff = useMemo(() => {
    if (dateRange === "all") return null;
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
    return Date.now() - days * 24 * 60 * 60 * 1000;
  }, [dateRange]);

  const filteredSessions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      if (dateCutoff && new Date(s.created_at).getTime() < dateCutoff) return false;
      if (subjectFilter !== "all" && subjectLabel(s) !== subjectFilter) return false;
      if (!q) return true;
      return [s.title, s.categoryName, s.subcategoryName, s.subject ?? "", s.topic ?? ""].some(
        (value) => value.toLowerCase().includes(q),
      );
    });
  }, [query, sessions, dateCutoff, subjectFilter]);

  const selected = useMemo(() => {
    if (!selectedId) return filteredSessions[0] ?? null;
    return (
      filteredSessions.find((s) => s.id === selectedId) ??
      sessions.find((s) => s.id === selectedId) ??
      filteredSessions[0] ??
      null
    );
  }, [selectedId, filteredSessions, sessions]);

  const baseRows: QuizReportRow[] = useMemo(
    () => (selected ? getQuizReportRows(selected.attempts) : []),
    [selected],
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
      getQuizReportRows(session.attempts).map((row) => ({
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
  }, [filteredSessions, statusFilter, studentQuery, sort]);

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
        questionCount: selected.attempts[0]?.totalQuestions ?? 0,
        attempts: selected.attempts,
      },
      { rows: filteredRows, filterSummary },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" /> Reports
          </h1>
          <p className="text-muted-foreground mt-1">
            Slice quiz results by date, subject, pass mark, and status — then export the filtered
            view.
          </p>
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
          Loading reports...
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
          <Trophy className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">No completed quiz reports yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Close a live quiz session and its final report will appear here.
          </p>
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
                <BarChart3 className="mr-1.5 h-4 w-4" /> Quiz
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
                <UserRound className="mr-1.5 h-4 w-4" /> Student
              </Button>
            </div>

            <div className="rounded-2xl border border-border bg-card/40 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Filter className="h-3.5 w-3.5" /> Filters
                </div>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-[11px] inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              </div>

              <FilterField icon={Search} label="Search">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Quiz title, subject, topic"
                  className="h-9"
                />
              </FilterField>

              <FilterField icon={CalendarRange} label="Date range">
                <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DATE_RANGE_LABEL) as DateRange[]).map((value) => (
                      <SelectItem key={value} value={value}>
                        {DATE_RANGE_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField icon={ListFilter} label="Subject">
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All subjects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects</SelectItem>
                    {subjectOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField icon={Target} label={`Pass mark (${passMark}%)`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={passMark}
                  onChange={(e) => setPassMark(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </FilterField>

              <FilterField icon={Search} label={reportMode === "quiz" ? "Find student" : "Search"}>
                <Input
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder={
                    reportMode === "quiz" ? "Name, email, roll, seat" : "Name, email, quiz"
                  }
                  className="h-9"
                />
              </FilterField>

              <FilterField icon={Flame} label="Status">
                <div className="grid grid-cols-3 gap-1.5">
                  {(["all", "completed", "pending"] as const).map((value) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={statusFilter === value ? "default" : "outline"}
                      onClick={() => setStatusFilter(value)}
                      className={statusFilter === value ? "bg-primary text-primary-foreground" : ""}
                    >
                      {value === "all" ? "All" : value === "completed" ? "Done" : "Left"}
                    </Button>
                  ))}
                </div>
              </FilterField>

              <FilterField icon={ArrowDownAZ} label="Sort by">
                <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SORT_LABEL) as SortOption[]).map((value) => (
                      <SelectItem key={value} value={value}>
                        {SORT_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              {reportMode === "student" && (
                <FilterField icon={UserRound} label="Student view">
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
                      Per attempt
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
                      Per student
                    </Button>
                  </div>
                </FilterField>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
              <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/50">
                {filteredSessions.length} {filteredSessions.length === 1 ? "quiz" : "quizzes"}
              </div>
              {filteredSessions.length === 0 ? (
                <div className="px-4 py-6 text-xs text-muted-foreground text-center">
                  No quizzes match these filters.
                </div>
              ) : (
                filteredSessions.map((s) => {
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
                        {categoryLabel(s) || "Uncategorised"}
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString()} · {s.attempts.length}{" "}
                        {s.attempts.length === 1 ? "participant" : "participants"}
                      </div>
                    </button>
                  );
                })
              )}
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
            <main className="space-y-5" id="report-print-area">
              <QuizReportHeader
                session={selected}
                top={filteredRows[0] ?? baseRows[0]}
                teacherName={teacherName}
                schoolName={schoolName}
              />

              <div className="grid gap-3 grid-cols-2 md:grid-cols-4 print:grid-cols-4">
                <Metric icon={Users} label="Participants" value={stats.total} />
                <Metric icon={Trophy} label="Submitted" value={stats.submitted} />
                <Metric icon={BarChart3} label="Average %" value={`${stats.avg}%`} />
                <Metric
                  icon={Target}
                  label={`Pass rate (≥${passMark}%)`}
                  value={`${stats.passRate}%`}
                />
              </div>

              <div className="grid gap-3 grid-cols-2 md:grid-cols-4 print:grid-cols-4">
                <Metric icon={Trophy} label="Best %" value={stats.best === null ? "—" : `${stats.best}%`} />
                <Metric
                  icon={Trophy}
                  label="Median %"
                  value={stats.median === null ? "—" : `${stats.median}%`}
                />
                <Metric
                  icon={BarChart3}
                  label="Lowest %"
                  value={stats.worst === null ? "—" : `${stats.worst}%`}
                />
                <Metric
                  icon={Timer}
                  label="Avg time"
                  value={stats.avgDuration === null ? "—" : formatDuration(stats.avgDuration)}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-3 print:grid-cols-3">
                <ScoreMetric
                  label="Correct answers"
                  value={stats.totals.correct}
                  tone="success"
                />
                <ScoreMetric label="Wrong answers" value={stats.totals.wrong} tone="danger" />
                <ScoreMetric
                  label="Unattempted"
                  value={stats.totals.unattempted}
                  tone="muted"
                />
              </div>

              <DistributionBar buckets={stats.buckets} passMark={passMark} />

              {filteredRows.length > 0 && (
                <div className="grid gap-3 md:grid-cols-3 print:grid-cols-3">
                  {filteredRows.slice(0, 3).map((row) => (
                    <div key={row.id} className="rounded-2xl border border-border bg-card/50 p-4">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Position {row.rank}
                      </div>
                      <div className="mt-1 font-display text-lg font-bold">{row.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {row.email || "No email"}
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-xl font-bold text-success">{row.score} pts</span>
                        <span className="text-xs text-muted-foreground">{row.percent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <AttemptsTable rows={filteredRows} passMark={passMark} />
            </main>
          ) : (
            <main className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
              <Filter className="mx-auto h-10 w-10 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium">No quizzes match these filters</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Loosen the date range, subject, or search to see results.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset filters
              </Button>
            </main>
          )}
        </div>
      )}
    </div>
  );
}

function FilterField({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Users;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
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
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 print:border-0 print:bg-transparent print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Final quiz report
          </div>
          <h2 className="font-display text-2xl font-bold">{session.title}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {[categoryLabel(session), new Date(session.created_at).toLocaleString()]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
            <ReportDetail label="Teacher" value={teacherName} />
            <ReportDetail label="School/Organization" value={schoolName || "Not specified"} />
            <ReportDetail label="Subject" value={subjectLabel(session)} />
            <ReportDetail label="Topic" value={session.topic || "Not specified"} />
          </dl>
        </div>
        {top && (
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Top position
            </div>
            <div className="font-display text-lg font-bold">{top.name}</div>
            <div className="text-success font-bold">
              {top.score} pts · {top.percent}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AttemptsTable({ rows, passMark }: { rows: QuizReportRow[]; passMark: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 overflow-x-auto">
      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No participants match these filters.
        </div>
      ) : (
        <table className="w-full text-sm min-w-[860px]">
          <thead className="bg-secondary/40">
            <tr>
              {[
                "Pos",
                "Name",
                "Email",
                "Roll",
                "Seat",
                "Points",
                "%",
                "Result",
                "Correct",
                "Wrong",
                "Unattempted",
                "Time",
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
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border/50">
                <td className="px-3 py-2 font-bold">{row.rank}</td>
                <td className="px-3 py-2 font-semibold">{row.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.email || "—"}</td>
                <td className="px-3 py-2">{row.rollNumber || "—"}</td>
                <td className="px-3 py-2">{row.seatNumber || "—"}</td>
                <td className="px-3 py-2 font-bold text-success">{row.score}</td>
                <td className="px-3 py-2 font-mono">{row.percent}%</td>
                <td className="px-3 py-2">
                  <ResultBadge row={row} passMark={passMark} />
                </td>
                <td className="px-3 py-2 text-success font-semibold">{row.correctAnswers}</td>
                <td className="px-3 py-2 text-destructive font-semibold">{row.wrongAnswers}</td>
                <td className="px-3 py-2">{row.unattemptedQuestions}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {formatDuration(row.durationSeconds ?? null)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ResultBadge({ row, passMark }: { row: QuizReportRow; passMark: number }) {
  if (!row.completed) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Left
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
      {passed ? "Pass" : "Fail"}
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
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Score distribution
        </div>
        <div className="text-[10px] text-muted-foreground">
          Pass mark {passMark}% · Top tier ≥ {Math.min(100, passMark + 25)}%
        </div>
      </div>
      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-muted/30 flex">
        <div className="h-full bg-success" style={{ width: `${pct(buckets.top)}%` }} />
        <div className="h-full bg-primary/80" style={{ width: `${pct(buckets.pass)}%` }} />
        <div className="h-full bg-destructive/80" style={{ width: `${pct(buckets.fail)}%` }} />
        <div className="h-full bg-muted-foreground/40" style={{ width: `${pct(buckets.left)}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <Legend dot="bg-success" label="Top tier" value={buckets.top} />
        <Legend dot="bg-primary/80" label="Passed" value={buckets.pass} />
        <Legend dot="bg-destructive/80" label="Below pass" value={buckets.fail} />
        <Legend dot="bg-muted-foreground/40" label="Did not finish" value={buckets.left} />
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
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold text-foreground">{value || "Not specified"}</dd>
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

  return (
    <main className="space-y-5">
      <div className="rounded-2xl border border-border bg-card/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Student report
            </div>
            <h2 className="font-display text-2xl font-bold">
              {mode === "students" ? "All students" : "All student attempts"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {mode === "students"
                ? "One row per student, rolled up across every quiz they appear in."
                : "Every attempt with quiz, score, and status."}
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-bold">
              {mode === "students" ? uniqueStudents : attemptRows.length}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {mode === "students" ? "students" : "matching attempts"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Metric icon={Users} label="Students" value={uniqueStudents} />
        <Metric icon={BarChart3} label="Attempts" value={attemptRows.length} />
        <Metric icon={Trophy} label="Submitted" value={completed} />
        <Metric icon={Target} label={`Pass rate (≥${passMark}%)`} value={`${passRate}%`} />
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
  return (
    <div className="rounded-2xl border border-border bg-card/40 overflow-x-auto">
      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          No students match these filters.
        </div>
      ) : (
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-secondary/40">
            <tr>
              {[
                "Student",
                "Email",
                "Attempts",
                "Submitted",
                "Avg %",
                "Best %",
                "Worst %",
                "Points",
                "Last attempt",
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
            {rows.map((row) => {
              const passing = row.avgPercent >= passMark;
              return (
                <tr key={row.key} className="border-t border-border/50">
                  <td className="px-3 py-2 font-semibold">{row.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.email || "—"}</td>
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
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
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
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <Metric icon={BarChart3} label="Average %" value={`${average}%`} />
        <Metric icon={Trophy} label="High score" value={`${rows[0]?.percent ?? 0}%`} />
        <Metric
          icon={Timer}
          label="Avg time"
          value={
            rows.length === 0
              ? "—"
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
            No attempts match these filters.
          </div>
        ) : (
          <table className="w-full text-sm min-w-[920px]">
            <thead className="bg-secondary/40">
              <tr>
                {[
                  "Student",
                  "Email",
                  "Quiz",
                  "Roll",
                  "Seat",
                  "Points",
                  "%",
                  "Result",
                  "Correct",
                  "Wrong",
                  "Time",
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
              {rows.map((row) => (
                <tr key={`${row.sessionId}-${row.id}`} className="border-t border-border/50">
                  <td className="px-3 py-2 font-semibold">{row.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.email || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.sessionTitle}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.sessionCategory || new Date(row.sessionCreatedAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-3 py-2">{row.rollNumber || "—"}</td>
                  <td className="px-3 py-2">{row.seatNumber || "—"}</td>
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
      </div>
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-3 font-display text-2xl font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function ScoreMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "muted";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4">
      <div className={`font-display text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
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
  const answers = a.quiz_answers ?? [];
  const correctAnswers = answers.filter((answer) => answer.is_correct === true).length;
  const wrongAnswers = answers.filter((answer) => answer.is_correct === false).length;
  const attemptedQuestions = answers.length;
  const unattemptedQuestions = Math.max(0, a.total_questions - attemptedQuestions);
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
