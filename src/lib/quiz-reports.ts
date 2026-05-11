export type QuizReportAttempt = {
  id: string;
  name: string;
  email: string | null;
  rollNumber?: string | null;
  seatNumber?: string | null;
  score: number;
  totalQuestions: number;
  attemptedQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unattemptedQuestions: number;
  completed: boolean;
  startedAt?: string | null;
  completedAt: string | null;
  durationSeconds?: number | null;
};

export type QuizReportSession = {
  title: string;
  categoryLabel?: string;
  teacherName?: string;
  schoolName?: string;
  subjectLabel?: string;
  topicLabel?: string;
  createdAt: string;
  questionCount: number;
  attempts: QuizReportAttempt[];
};

export type QuizReportRow = QuizReportAttempt & {
  rank: number;
  percent: number;
};

export function getQuizReportRows(attempts: QuizReportAttempt[]): QuizReportRow[] {
  return attempts
    .slice()
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.attemptedQuestions !== a.attemptedQuestions) {
        return b.attemptedQuestions - a.attemptedQuestions;
      }
      return a.name.localeCompare(b.name);
    })
    .map((a, index) => ({
      ...a,
      rank: index + 1,
      percent: Math.round((a.score / Math.max(1, a.totalQuestions)) * 100),
    }));
}

export function downloadQuizReportCsv(
  session: QuizReportSession,
  options?: { rows?: QuizReportRow[]; filterSummary?: string },
) {
  const rows = options?.rows ?? getQuizReportRows(session.attempts);
  const headers = [
    "Position",
    "Name",
    "Email",
    "Roll Number",
    "Seat Number",
    "Points",
    "Correct",
    "Wrong",
    "Unattempted",
    "Attempted Questions",
    "Total Questions",
    "Percent",
    "Duration",
    "Status",
    "Completed At",
  ];
  const csv = [
    [`Quiz Report: ${session.title}`],
    [`Teacher: ${session.teacherName || "Not specified"}`],
    [`School/Organization: ${session.schoolName || "Not specified"}`],
    [`Subject: ${session.subjectLabel || session.categoryLabel || "Not specified"}`],
    [`Topic: ${session.topicLabel || "Not specified"}`],
    [`Category: ${session.categoryLabel || "Uncategorised"}`],
    options?.filterSummary ? [`Filters: ${options.filterSummary}`] : null,
    [`Generated: ${new Date().toLocaleString()}`],
    [],
    headers,
    ...rows.map((r) => [
      r.rank,
      r.name,
      r.email ?? "",
      r.rollNumber ?? "",
      r.seatNumber ?? "",
      r.score,
      r.correctAnswers,
      r.wrongAnswers,
      r.unattemptedQuestions,
      r.attemptedQuestions,
      r.totalQuestions,
      `${r.percent}%`,
      formatDuration(r.durationSeconds ?? null),
      r.completed ? "Completed" : "Did not finish",
      r.completedAt ? new Date(r.completedAt).toLocaleString() : "",
    ]),
  ]
    .filter((row): row is (string | number)[] => row !== null)
    .map((row) => row.map(csvCell).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(session.title)}-quiz-report.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value: string | number) {
  const text = String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "quiz"
  );
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds) || seconds < 0) return "-";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds - m * 60);
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m - h * 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}
