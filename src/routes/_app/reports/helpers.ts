import type { QuizReportAttempt, QuizReportRow } from "@/lib/quiz-reports";
import type {
  AttemptRow,
  ReportSession,
  ProfileRow,
  SortOption,
  DateRange,
  StatusFilter,
  StudentAttemptRow,
  StudentSummaryRow,
} from "./types";
import { SORT_KEYS, DATE_RANGE_KEYS } from "./types";

export function categoryLabel(s: Pick<ReportSession, "categoryName" | "subcategoryName">) {
  return [s.categoryName, s.subcategoryName].filter(Boolean).join(" → ");
}

export function subjectLabel(
  s: Pick<ReportSession, "subject" | "categoryName" | "subcategoryName">,
) {
  return s.subject || categoryLabel(s) || "Not specified";
}

export function toReportAttempt(a: AttemptRow, totalMaxPoints?: number | null): QuizReportAttempt {
  const meta =
    a.participants?.metadata && typeof a.participants.metadata === "object"
      ? (a.participants.metadata as Record<string, unknown>)
      : {};
  const attemptedQuestions = a.completed ? a.total_questions : 0;
  const unattemptedQuestions = a.completed ? 0 : a.total_questions;
  const startedAt = a.started_at ?? null;
  const completedAt = a.completed_at ?? null;
  const durationSeconds =
    startedAt && completedAt
      ? Math.max(
          0,
          Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000),
        )
      : null;
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
    startedAt,
    completedAt,
    durationSeconds,
  };
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

export function sortRows<T extends QuizReportRow>(rows: T[], sort: SortOption): T[] {
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

export function computeQuizStats(rows: QuizReportRow[], passMark: number) {
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

  const durations = submittedRows.flatMap((r) => {
    const d = r.durationSeconds;
    return typeof d === "number" && d > 0 ? [d] : [];
  });
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

export function aggregateByStudent(rows: StudentAttemptRow[]): StudentSummaryRow[] {
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
      if (last && (!existing.lastAttemptAt || new Date(last) > new Date(existing.lastAttemptAt))) {
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

export function buildFilterSummary(args: {
  dateRange: DateRange;
  subjectFilter: string;
  statusFilter: StatusFilter;
  passMark: number;
  studentQuery: string;
  sort: SortOption;
}) {
  const parts: string[] = [];
  if (args.dateRange !== "all") parts.push(DATE_RANGE_KEYS[args.dateRange]);
  if (args.subjectFilter !== "all") parts.push(`Subject: ${args.subjectFilter}`);
  if (args.statusFilter !== "all") parts.push(`Status: ${args.statusFilter}`);
  parts.push(`Pass mark: ${args.passMark}%`);
  if (args.studentQuery.trim()) parts.push(`Search: ${args.studentQuery.trim()}`);
  if (args.sort !== "rank") parts.push(`Sort: ${SORT_KEYS[args.sort]}`);
  return parts.join(" · ");
}
