import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { CheckCircle2, PenLine, Trophy } from "lucide-react";
import { PaginationControls } from "@/components/PaginationControls";
import { paginate } from "@/lib/pagination";
import { getQuizReportRows } from "@/lib/quiz-reports";
import type { QuizReportAttempt } from "@/lib/quiz-reports";
import type { LeaderboardEntry } from "@/components/sessions/Leaderboard";
import type { Attendee } from "./types";
import { RESULT_PAGE_SIZE } from "./types";
import { LeaderboardLoading } from "./LiveView";

const Leaderboard = lazy(() =>
  import("@/components/sessions/Leaderboard").then((m) => ({ default: m.Leaderboard })),
);

function ReportDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold text-foreground">{value || "Not specified"}</p>
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

export function ResultsView({
  attendees,
  title,
  categoryLabel,
  questionCount,
  createdAt,
  reportAttempts,
  teacherName,
  schoolName,
  subjectLabel,
  topicLabel,
  hasTypedQuestions,
  pendingGradingCount,
}: {
  attendees: Attendee[];
  title: string;
  categoryLabel: string;
  questionCount: number;
  createdAt: string;
  reportAttempts: QuizReportAttempt[];
  teacherName: string;
  schoolName: string;
  subjectLabel: string;
  topicLabel: string;
  hasTypedQuestions: boolean;
  pendingGradingCount: number;
}) {
  const entries: LeaderboardEntry[] = attendees.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    rollNumber: a.rollNumber,
    score: a.score,
    total: a.total,
    completed: a.completed,
  }));
  const submittedCount = attendees.filter((a) => a.completed).length;
  const [resultPage, setResultPage] = useState(0);
  const rows = useMemo(
    () =>
      getQuizReportRows(reportAttempts).sort(
        (a, b) => b.score - a.score || b.percent - a.percent || a.rank - b.rank,
      ),
    [reportAttempts],
  );
  const visibleRows = paginate(rows, resultPage, RESULT_PAGE_SIZE);
  const top = rows[0];
  const totals = rows.reduce(
    (sum, row) => ({
      pointsEarned: sum.pointsEarned + row.score,
      attempted: sum.attempted + row.attemptedQuestions,
      unattempted: sum.unattempted + row.unattemptedQuestions,
    }),
    { pointsEarned: 0, attempted: 0, unattempted: 0 },
  );

  // react-doctor-disable-next-line react-doctor/no-reset-all-state-on-prop-change
  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-adjust-state-on-prop-change
    setResultPage(0);
  }, [rows.length]);

  return (
    <div className="space-y-5 print:space-y-3" id="quiz-results">
      <div className="rounded-2xl border border-border bg-card/60 p-6 print:border-0 print:bg-transparent print:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow print:bg-transparent print:border-black print:shadow-none print:text-black">
              <Trophy className="size-6" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Final Results
              </div>
              <h2 className="font-display text-2xl font-semibold">{title}</h2>
              <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                {categoryLabel && (
                  <>
                    <span>{categoryLabel}</span>
                    <span>·</span>
                  </>
                )}
                <span>
                  {questionCount} question{questionCount === 1 ? "" : "s"}
                </span>
                <span>·</span>
                <span>{submittedCount} submitted</span>
                <span>·</span>
                <span>{new Date(createdAt).toLocaleString()}</span>
              </div>
              <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                <ReportDetail label="Teacher" value={teacherName} />
                <ReportDetail label="School/Organization" value={schoolName || "Not specified"} />
                <ReportDetail label="Subject" value={subjectLabel} />
                <ReportDetail label="Topic" value={topicLabel || "Not specified"} />
              </div>
            </div>
          </div>
          {top && (
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Winner
              </div>
              <div className="font-display text-lg font-bold">{top.name}</div>
              <div className="text-success font-bold">
                {top.score}
                <span className="text-xs text-muted-foreground font-normal">
                  /{top.totalMaxPoints ?? top.totalQuestions} pts
                </span>
              </div>
              <div className="text-xs text-muted-foreground">{top.percent}%</div>
            </div>
          )}
        </div>
      </div>

      {hasTypedQuestions && pendingGradingCount > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5 text-xs text-warning flex items-start gap-2 print:hidden">
          <PenLine className="size-3.5 mt-0.5 shrink-0" />
          <span>
            These scores include only MCQ &amp; True/False answers. {pendingGradingCount} short/long
            answer{pendingGradingCount > 1 ? "s" : ""} still need grading, final scores will update
            after grading is complete.
          </span>
        </div>
      )}
      {hasTypedQuestions && pendingGradingCount === 0 && (
        <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-2.5 text-xs text-success flex items-start gap-2 print:hidden">
          <CheckCircle2 className="size-3.5 mt-0.5 shrink-0" />
          <span>
            All short/long answers have been graded. Scores below include all question types.
          </span>
        </div>
      )}

      {rows.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3 print:grid-cols-3">
          {rows.slice(0, 3).map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border border-border bg-card/50 p-4 print:border-black"
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Position {row.rank}
              </div>
              <div className="mt-1 font-display text-lg font-bold">{row.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {row.email || "No email"}
              </div>
              <div className="mt-2 text-xl font-bold text-success">
                {row.score}
                <span className="text-sm text-muted-foreground font-normal">
                  /{row.totalMaxPoints ?? row.totalQuestions}
                </span>
                <span className="text-sm text-muted-foreground font-normal ml-1">
                  pts · {row.percent}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3 print:grid-cols-3">
        <ScoreMetric label="Points earned" value={totals.pointsEarned} tone="success" />
        <ScoreMetric label="Attempted" value={totals.attempted} tone="muted" />
        <ScoreMetric label="Unattempted" value={totals.unattempted} tone="muted" />
      </div>

      <div className="rounded-2xl border border-border bg-card/40 p-5 print:border-0 print:bg-transparent print:p-0">
        <Suspense fallback={<LeaderboardLoading />}>
          <Leaderboard entries={entries} mode="final" />
        </Suspense>
      </div>

      <div className="rounded-2xl border border-border bg-card/40 overflow-hidden print:border-black">
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
                "%",
                "Unattempted",
                "Attempted",
                "Total",
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
              <tr key={row.id} className="border-t border-border/50">
                <td className="px-3 py-2 font-bold">{row.rank}</td>
                <td className="px-3 py-2 font-semibold">{row.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.email || "-"}</td>
                <td className="px-3 py-2">{row.rollNumber || "-"}</td>
                <td className="px-3 py-2">{row.seatNumber || "-"}</td>
                <td className="px-3 py-2 font-bold text-success">
                  {row.score}
                  <span className="text-xs text-muted-foreground font-normal">
                    /{row.totalMaxPoints ?? row.totalQuestions}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{row.percent}%</td>
                <td className="px-3 py-2">{row.unattemptedQuestions}</td>
                <td className="px-3 py-2">{row.attemptedQuestions}</td>
                <td className="px-3 py-2">{row.totalQuestions}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationControls
          page={resultPage}
          pageSize={RESULT_PAGE_SIZE}
          total={rows.length}
          label="participants"
          onPageChange={setResultPage}
        />
      </div>
    </div>
  );
}
