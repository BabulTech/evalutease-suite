import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Download, FileText, ListFilter, Search, Trophy, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  downloadQuizReportCsv,
  getQuizReportRows,
  type QuizReportAttempt,
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

function ReportsPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ReportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [reportMode, setReportMode] = useState<"quiz" | "student">("quiz");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "pending">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

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
          "id, session_id, participant_name, participant_email, score, total_questions, completed, completed_at, quiz_answers ( id, is_correct ), participants ( metadata )",
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) =>
      [s.title, s.categoryName, s.subcategoryName].some((value) =>
        value.toLowerCase().includes(q),
      ),
    );
  }, [query, sessions]);

  const selected = sessions.find((s) => s.id === selectedId) ?? filtered[0] ?? null;
  const rows = selected ? getQuizReportRows(selected.attempts) : [];
  const filteredRows = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    return rows.filter((row) => {
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
  }, [rows, statusFilter, studentQuery]);
  const studentRows = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    return filtered
      .flatMap((session) =>
        getQuizReportRows(session.attempts).map((row) => ({
          ...row,
          sessionTitle: session.title,
          sessionCategory: categoryLabel(session),
          sessionCreatedAt: session.created_at,
        })),
      )
      .filter((row) => {
        const statusOk =
          statusFilter === "all" ||
          (statusFilter === "completed" ? row.completed : !row.completed);
        if (!statusOk) return false;
        if (!q) return true;
        return [row.name, row.email, row.rollNumber, row.seatNumber, row.sessionTitle, row.sessionCategory]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  }, [filtered, statusFilter, studentQuery]);
  const submitted = rows.filter((r) => r.completed);
  const top = submitted[0] ?? rows[0];
  const avg =
    submitted.length === 0
      ? 0
      : Math.round(submitted.reduce((sum, r) => sum + r.percent, 0) / submitted.length);
  const totals = rows.reduce(
    (sum, row) => ({
      correct: sum.correct + row.correctAnswers,
      wrong: sum.wrong + row.wrongAnswers,
      unattempted: sum.unattempted + row.unattemptedQuestions,
    }),
    { correct: 0, wrong: 0, unattempted: 0 },
  );
  const teacherName = getTeacherName(profile, user?.email);
  const schoolName = profile?.organization ?? "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" /> Reports
          </h1>
          <p className="text-muted-foreground mt-1">
            Download final quiz reports with positions, participant details, points, and attempts.
          </p>
        </div>
        {selected && (
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" onClick={() => window.print()} className="gap-1.5">
              <FileText className="h-4 w-4" /> PDF
            </Button>
            <Button
              onClick={() =>
                downloadQuizReportCsv({
                  title: selected.title,
                  categoryLabel: categoryLabel(selected),
                  teacherName,
                  schoolName,
                  subjectLabel: subjectLabel(selected),
                  topicLabel: selected.topic ?? "",
                  createdAt: selected.created_at,
                  questionCount: selected.attempts[0]?.totalQuestions ?? 0,
                  attempts: selected.attempts,
                })
              }
              className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow"
            >
              <Download className="h-4 w-4" /> Excel
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
                className={reportMode === "quiz" ? "bg-gradient-primary text-primary-foreground shadow-glow" : ""}
              >
                <BarChart3 className="mr-1.5 h-4 w-4" /> Quiz
              </Button>
              <Button
                type="button"
                variant={reportMode === "student" ? "default" : "outline"}
                onClick={() => setReportMode("student")}
                className={reportMode === "student" ? "bg-gradient-primary text-primary-foreground shadow-glow" : ""}
              >
                <UserRound className="mr-1.5 h-4 w-4" /> Student
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reports"
                className="pl-9"
              />
            </div>
            <div className="rounded-2xl border border-border bg-card/40 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <ListFilter className="h-3.5 w-3.5" /> Filters
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={studentQuery}
                  onChange={(e) => setStudentQuery(e.target.value)}
                  placeholder={reportMode === "quiz" ? "Filter students" : "Student, email, or quiz"}
                  className="pl-8"
                />
              </div>
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
            </div>
            <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
              {filtered.map((s) => {
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
                      {new Date(s.created_at).toLocaleDateString()} - {s.attempts.length} participants
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {reportMode === "student" ? (
            <StudentReportsView rows={studentRows} />
          ) : selected && (
            <main className="space-y-5" id="report-print-area">
              <div className="rounded-2xl border border-border bg-card/60 p-6 print:border-0 print:bg-transparent print:p-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Final quiz report
                    </div>
                    <h2 className="font-display text-2xl font-bold">{selected.title}</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {[categoryLabel(selected), new Date(selected.created_at).toLocaleString()]
                        .filter(Boolean)
                        .join(" - ")}
                    </p>
                    <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                      <ReportDetail label="Teacher" value={teacherName} />
                      <ReportDetail label="School/Organization" value={schoolName || "Not specified"} />
                      <ReportDetail label="Subject" value={subjectLabel(selected)} />
                      <ReportDetail label="Topic" value={selected.topic || "Not specified"} />
                    </dl>
                  </div>
                  {top && (
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Top position
                      </div>
                      <div className="font-display text-lg font-bold">{top.name}</div>
                      <div className="text-success font-bold">{top.score} pts</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4 print:grid-cols-4">
                <Metric icon={Users} label="Participants" value={rows.length} />
                <Metric icon={Trophy} label="Submitted" value={submitted.length} />
                <Metric icon={BarChart3} label="Average" value={`${avg}%`} />
                <Metric
                  icon={FileText}
                  label="Questions"
                  value={selected.attempts[0]?.totalQuestions ?? 0}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-3 print:grid-cols-3">
                <ScoreMetric label="Correct answers" value={totals.correct} tone="success" />
                <ScoreMetric label="Wrong answers" value={totals.wrong} tone="danger" />
                <ScoreMetric label="Unattempted" value={totals.unattempted} tone="muted" />
              </div>

              <div className="grid gap-3 md:grid-cols-3 print:grid-cols-3">
                {rows.slice(0, 3).map((row) => (
                  <div key={row.id} className="rounded-2xl border border-border bg-card/50 p-4">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Position {row.rank}
                    </div>
                    <div className="mt-1 font-display text-lg font-bold">{row.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{row.email || "No email"}</div>
                    <div className="mt-2 text-xl font-bold text-success">{row.score} pts</div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40">
                    <tr>
                      {[
                        "Pos",
                        "Name",
                        "Email",
                        "Roll",
                        "Seat",
                        "Points",
                        "Correct",
                        "Wrong",
                        "Unattempted",
                        "Attempted",
                        "Total",
                      ].map(
                        (h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-muted-foreground"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.id} className="border-t border-border/50">
                        <td className="px-3 py-2 font-bold">{row.rank}</td>
                        <td className="px-3 py-2 font-semibold">{row.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.email || "-"}</td>
                        <td className="px-3 py-2">{row.rollNumber || "-"}</td>
                        <td className="px-3 py-2">{row.seatNumber || "-"}</td>
                        <td className="px-3 py-2 font-bold text-success">{row.score}</td>
                        <td className="px-3 py-2 text-success font-semibold">{row.correctAnswers}</td>
                        <td className="px-3 py-2 text-destructive font-semibold">{row.wrongAnswers}</td>
                        <td className="px-3 py-2">{row.unattemptedQuestions}</td>
                        <td className="px-3 py-2">{row.attemptedQuestions}</td>
                        <td className="px-3 py-2">{row.totalQuestions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </main>
          )}
        </div>
      )}
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

function StudentReportsView({
  rows,
}: {
  rows: Array<ReturnType<typeof getQuizReportRows>[number] & {
    sessionTitle: string;
    sessionCategory: string;
    sessionCreatedAt: string;
  }>;
}) {
  const completed = rows.filter((row) => row.completed).length;
  const average =
    rows.length === 0 ? 0 : Math.round(rows.reduce((sum, row) => sum + row.percent, 0) / rows.length);

  return (
    <main className="space-y-5">
      <div className="rounded-2xl border border-border bg-card/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Student report
            </div>
            <h2 className="font-display text-2xl font-bold">All student attempts</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Filter by student, email, roll, seat, quiz name, and submission status.
            </p>
          </div>
          <div className="text-right">
            <div className="font-display text-2xl font-bold">{rows.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              matching attempts
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric icon={Users} label="Attempts" value={rows.length} />
        <Metric icon={Trophy} label="Submitted" value={completed} />
        <Metric icon={BarChart3} label="Average" value={`${average}%`} />
      </div>

      <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40">
            <tr>
              {[
                "Student",
                "Email",
                "Quiz",
                "Roll",
                "Seat",
                "Points",
                "Correct",
                "Wrong",
                "Unattempted",
                "Status",
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
              <tr key={`${row.sessionTitle}-${row.id}`} className="border-t border-border/50">
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
                <td className="px-3 py-2 text-success font-semibold">{row.correctAnswers}</td>
                <td className="px-3 py-2 text-destructive font-semibold">{row.wrongAnswers}</td>
                <td className="px-3 py-2">{row.unattemptedQuestions}</td>
                <td className="px-3 py-2">{row.completed ? "Completed" : "Left"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
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
    tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4">
      <div className={`font-display text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function categoryLabel(s: Pick<ReportSession, "categoryName" | "subcategoryName">) {
  return [s.categoryName, s.subcategoryName].filter(Boolean).join(" -> ");
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

function getTeacherName(profile: ProfileRow | null, email?: string | null) {
  const full = profile?.full_name?.trim();
  if (full) return full;
  const joined = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  return joined || email?.split("@")[0] || "Teacher";
}

function stringMeta(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
