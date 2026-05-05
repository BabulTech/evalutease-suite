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
  completedAt: string | null;
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

export function downloadQuizReportCsv(session: QuizReportSession) {
  const rows = getQuizReportRows(session.attempts);
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
      r.completed ? "Completed" : "Did not finish",
      r.completedAt ? new Date(r.completedAt).toLocaleString() : "",
    ]),
  ]
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
