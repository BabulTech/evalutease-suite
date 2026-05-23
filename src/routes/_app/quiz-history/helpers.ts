import type { QuizReportAttempt } from "@/lib/quiz-reports";
import type { HistoryTrends } from "@/components/history/HistoryTrendCharts";
import type { AttemptRow, SessionWithStats, ProfileRow } from "./types";

export function buildHistoryTrends(sessions: SessionWithStats[]): HistoryTrends {
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

export function getWeekOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const diffDays = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return Math.ceil((diffDays + start.getDay() + 1) / 7);
}

export function toReportAttempt(a: AttemptRow, totalMaxPoints?: number | null): QuizReportAttempt {
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

export function subjectLabel(
  s: Pick<SessionWithStats, "subject" | "categoryName" | "subcategoryName">,
) {
  return (
    s.subject || [s.categoryName, s.subcategoryName].filter(Boolean).join(" -> ") || "Not specified"
  );
}

export function getTeacherName(profile: ProfileRow | null, email?: string | null) {
  const full = profile?.full_name?.trim();
  if (full) return full;
  const joined = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  return joined || email?.split("@")[0] || "Teacher";
}

export function stringMeta(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
