import { useEffect, useState } from "react";
import { BarChart3, Target, Timer, Trophy, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDuration } from "@/lib/quiz-reports";
import { PaginationControls } from "@/components/PaginationControls";
import { paginate } from "@/lib/pagination";
import { REPORT_PAGE_SIZE } from "./types";
import type { StudentAttemptRow, StudentSummaryRow, StudentMode } from "./types";
import { Metric, ResultBadge } from "./ReportUi";

export function StudentReportsView({
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
  const passRate = attemptRows.length === 0 ? 0 : Math.round((passed / attemptRows.length) * 100);
  const uniqueStudents = summaryRows.length;
  const { t } = useI18n();

  return (
    <main className="space-y-5 min-w-0 overflow-hidden">
      <div className="rounded-2xl border border-border bg-card/60 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {t("rep.studentReport")}
            </div>
            <h2 className="font-display text-2xl font-semibold">
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
        <Metric
          icon={Users}
          label={t("rep.uniqueStudents")}
          value={uniqueStudents}
          desc={t("rep.uniqueStudentsDesc")}
        />
        <Metric
          icon={BarChart3}
          label={t("rep.totalAttempts")}
          value={attemptRows.length}
          desc={t("rep.totalAttemptsDesc")}
        />
        <Metric
          icon={Trophy}
          label={t("rep.submittedAttempts")}
          value={completed}
          desc={t("rep.submittedAttemptsDesc")}
        />
        <Metric
          icon={Target}
          label={t("rep.passRate")}
          value={`${passRate}%`}
          desc={`% of attempts scoring ≥ ${passMark}%`}
          color={passRate >= 60 ? "text-success" : "text-destructive"}
        />
      </div>

      {mode === "students" ? (
        <StudentSummaryTable rows={summaryRows} passMark={passMark} />
      ) : (
        <StudentAttemptsTable rows={attemptRows} passMark={passMark} average={average} />
      )}
    </main>
  );
}

function StudentSummaryTable({ rows, passMark }: { rows: StudentSummaryRow[]; passMark: number }) {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const visibleRows = paginate(rows, page, REPORT_PAGE_SIZE);

  // react-doctor-disable-next-line react-doctor/no-derived-state-effect
  // react-doctor-disable-next-line react-doctor/no-adjust-state-on-prop-change
  // react-doctor-disable-next-line react-doctor/no-reset-all-state-on-prop-change
  // react-doctor-disable-next-line react-doctor/no-derived-state-effect
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
                    className={`px-3 py-2 font-bold ${passing ? "text-success" : "text-destructive"}`}
                  >
                    {row.avgPercent}%
                  </td>
                  <td className="px-3 py-2 text-success font-semibold">{row.bestPercent}%</td>
                  <td className="px-3 py-2 text-destructive font-semibold">{row.worstPercent}%</td>
                  <td className="px-3 py-2">{row.totalPoints}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.lastAttemptAt ? new Date(row.lastAttemptAt).toLocaleDateString() : "-"}
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

  // react-doctor-disable-next-line react-doctor/no-derived-state-effect
  // react-doctor-disable-next-line react-doctor/no-adjust-state-on-prop-change
  // react-doctor-disable-next-line react-doctor/no-reset-all-state-on-prop-change
  // react-doctor-disable-next-line react-doctor/no-derived-state-effect
  useEffect(() => {
    setPage(0);
  }, [rows]);

  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <Metric
          icon={BarChart3}
          label={t("rep.averageScore")}
          value={`${average}%`}
          desc={t("rep.averageScoreDesc")}
          color={average >= passMark ? "text-success" : "text-destructive"}
        />
        <Metric
          icon={Trophy}
          label={t("rep.highestScore")}
          value={`${rows[0]?.percent ?? 0}%`}
          desc={t("rep.highestScoreDesc")}
          color="text-success"
        />
        <Metric
          icon={Timer}
          label={t("rep.averageTime")}
          desc={t("rep.averageTimeDesc")}
          value={
            rows.length === 0
              ? "-"
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
                  <td className="px-3 py-2 font-bold text-success">
                    {row.score}
                    <span className="text-xs text-muted-foreground font-normal">
                      /{row.totalMaxPoints ?? row.totalQuestions}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono">{row.percent}%</td>
                  <td className="px-3 py-2">
                    <ResultBadge row={row} passMark={passMark} />
                  </td>
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
