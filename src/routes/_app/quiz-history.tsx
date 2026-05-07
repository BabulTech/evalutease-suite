import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadQuizReportCsv, getQuizReportRows, type QuizReportAttempt } from "@/lib/quiz-reports";

export const Route = createFileRoute("/_app/quiz-history")({
  component: QuizHistoryPage,
});

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
  quiz_answers: { id: string; is_correct: boolean | null }[] | null;
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
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  // Filters
  const [filterTitle, setFilterTitle] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

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
    const { data: ss, error } = await supabase
      .from("quiz_sessions")
      .select(
        "id, title, created_at, category_id, subcategory_id, default_time_per_question, subject, topic, description",
      )
      .eq("owner_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    const rows = (ss ?? []) as SessionRow[];
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
        .select(
          "id, session_id, participant_id, participant_name, participant_email, score, total_questions, completed, completed_at, quiz_answers ( id, is_correct ), participants ( metadata )",
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
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Print only the specific quiz section
  const printQuiz = (s: SessionWithStats) => {
    const reportRows = getQuizReportRows(s.attempts.map(toReportAttempt));
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

    const html = `<!DOCTYPE html><html><head><title>${s.title} — Report</title>
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
      Type: ${QUIZ_TYPE_LABELS[s.topic ?? ""] ?? s.topic ?? "—"} ·
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

  // Filtered sessions
  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (filterTitle && !s.title.toLowerCase().includes(filterTitle.toLowerCase())) return false;
      if (filterType && s.topic !== filterType) return false;
      if (filterDateFrom && new Date(s.created_at) < new Date(filterDateFrom)) return false;
      if (filterDateTo && new Date(s.created_at) > new Date(filterDateTo + "T23:59:59")) return false;
      return true;
    });
  }, [sessions, filterTitle, filterType, filterDateFrom, filterDateTo]);

  const hasFilters = filterTitle || filterType || filterDateFrom || filterDateTo;

  const clearFilters = () => {
    setFilterTitle("");
    setFilterType("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Quiz History</h1>
          <p className="text-muted-foreground mt-1">
            Closed quiz sessions with their final participant results. Click any session to expand.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {hasFilters && (
              <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                !
              </span>
            )}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 print:hidden" onClick={printAll}>
            <Printer className="h-3.5 w-3.5" /> Print All
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3 print:hidden">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Filter History</span>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={clearFilters}>
                <X className="h-3 w-3" /> Clear all
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Quiz Title</label>
              <Input
                placeholder="Search title…"
                value={filterTitle}
                onChange={(e) => setFilterTitle(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Quiz Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All types</option>
                {Object.entries(QUIZ_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">From date</label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">To date</label>
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
              Showing {filtered.length} of {sessions.length} sessions
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
          <Archive className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">No completed sessions yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Once you close a live quiz session, it'll move here with the leaderboard.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
          <Filter className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">No sessions match your filters</p>
          <Button variant="ghost" size="sm" className="mt-2" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((s) => {
            const isOpen = openIds.has(s.id);
            const reportRows = getQuizReportRows(s.attempts.map(toReportAttempt));
            const submitted = reportRows.filter((a) => a.completed);
            const top = submitted[0];
            const teacherName = getTeacherName(profile, user?.email);
            const schoolName = profile?.organization ?? "";
            const quizTypeLabel = QUIZ_TYPE_LABELS[s.topic ?? ""] ?? s.topic ?? "—";

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
                            "Uncategorised"}
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
                        <span>{submitted.length} submitted</span>
                        <span>·</span>
                        <span>{s.avgPercent}% avg</span>
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
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
                      <div>
                        <div className="text-xs font-semibold">Final report</div>
                        <p className="text-xs text-muted-foreground">
                          Ranked by points — email, roll/seat, attempted, correct, wrong.
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Teacher: {teacherName} · School: {schoolName || "Not specified"} · Type:{" "}
                          {quizTypeLabel} · Subject: {subjectLabel(s)}
                        </p>
                      </div>
                      <div className="flex gap-2" ref={downloadRef}>
                        {/* Print this quiz */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => printQuiz(s)}
                          className="gap-1.5"
                        >
                          <Printer className="h-3.5 w-3.5" /> Print
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
                            <Download className="h-3.5 w-3.5" /> Download
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
                                    questionCount: s.attempts[0]?.total_questions ?? 0,
                                    attempts: s.attempts.map(toReportAttempt),
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
                        No participants completed this quiz.
                      </p>
                    ) : (
                      <ol className="space-y-1.5">
                        {submitted.map((a) => (
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
                                  a.email || "No email",
                                  a.rollNumber ? `Roll ${a.rollNumber}` : "",
                                  a.seatNumber ? `Seat ${a.seatNumber}` : "",
                                  `${a.correctAnswers} correct`,
                                  `${a.wrongAnswers} wrong`,
                                  `${a.unattemptedQuestions} unattempted`,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-success">{a.score} pts</div>
                              <div className="text-[10px] text-muted-foreground">
                                {a.attemptedQuestions}/{a.totalQuestions} attempted
                              </div>
                              {a.completedAt && (
                                <div className="text-[10px] text-muted-foreground">
                                  {new Date(a.completedAt).toLocaleTimeString()}
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
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
