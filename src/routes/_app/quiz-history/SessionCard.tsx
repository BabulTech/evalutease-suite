import {
  ChevronDown,
  ChevronRight,
  Clock,
  Crown,
  Download,
  FileSpreadsheet,
  FileText,
  PenLine,
  Printer,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { PaginationControls } from "@/components/PaginationControls";
import { downloadQuizReportCsv, getQuizReportRows } from "@/lib/quiz-reports";
import { paginate } from "@/lib/pagination";
import { printQuizResults } from "@/lib/quiz-reports";
import type { PlanInfo } from "@/contexts/PlanContext";
import { HISTORY_PAGE_SIZE, QUIZ_TYPE_LABELS } from "./types";
import type { SessionWithStats, AttemptRow, ProfileRow } from "./types";
import { toReportAttempt, subjectLabel, getTeacherName } from "./helpers";

type Props = {
  s: SessionWithStats;
  isOpen: boolean;
  toggle: (id: string) => void;
  expandedAttempts: Record<string, AttemptRow[]>;
  expandingIds: Set<string>;
  attemptAnswerStats: Record<
    string,
    Record<string, { correct: number; wrong: number; attempted: number }>
  >;
  sessionMaxPts: Record<string, number>;
  attemptPages: Record<string, number>;
  setAttemptPages: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  downloadOpenId: string | null;
  setDownloadOpenId: (id: string | null) => void;
  downloadRef: React.RefObject<HTMLDivElement | null>;
  profile: ProfileRow | null;
  userEmail?: string | null;
  plan: PlanInfo | null;
};

// eslint-disable-next-line sonarjs/cognitive-complexity -- large session card component with many conditional display states
export function SessionCard({
  s,
  isOpen,
  toggle,
  expandedAttempts,
  expandingIds,
  attemptAnswerStats,
  sessionMaxPts,
  attemptPages,
  setAttemptPages,
  downloadOpenId,
  setDownloadOpenId,
  downloadRef,
  profile,
  userEmail,
  plan,
}: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();

  const fullAttempts = expandedAttempts[s.id] ?? s.attempts;
  const reportRows = getQuizReportRows(
    fullAttempts.map((a) => toReportAttempt(a, sessionMaxPts[s.id])),
  );
  const submitted = reportRows.filter((a) => a.completed);
  const attemptPage = attemptPages[s.id] ?? 0;
  const visibleSubmitted = paginate(submitted, attemptPage, HISTORY_PAGE_SIZE);
  const isLoadingExpand = expandingIds.has(s.id);
  const top = submitted[0];
  const teacherName = getTeacherName(profile, userEmail);
  const schoolName = profile?.organization ?? "";
  const quizTypeLabel = QUIZ_TYPE_LABELS[s.topic ?? ""] ?? s.topic ?? "-";
  const avgColor =
    s.avgPercent >= 70 ? "text-success" : s.avgPercent >= 40 ? "text-warning" : "text-destructive";
  const avgBarColor =
    s.avgPercent >= 70
      ? "bg-success/60"
      : s.avgPercent >= 40
        ? "bg-warning/60"
        : "bg-destructive/50";
  const avgPct = s.avgPercent;
  const maxScore = submitted.length > 0 ? Math.max(...submitted.map((a) => a.score), 1) : 1;

  const handlePrint = () => {
    printQuizResults({
      title: s.title,
      categoryLabel: [s.categoryName, s.subcategoryName].filter(Boolean).join(" → "),
      teacherName,
      schoolName,
      subjectLabel: subjectLabel(s),
      topicLabel: QUIZ_TYPE_LABELS[s.topic ?? ""] ?? s.topic ?? "",
      createdAt: s.created_at,
      questionCount: fullAttempts[0]?.total_questions ?? 0,
      attempts: fullAttempts.map((a) => toReportAttempt(a, sessionMaxPts[s.id])),
    });
  };

  return (
    <li className="rounded-2xl border border-border bg-card/60 transition-all hover:border-primary/30 hover:shadow-glow overflow-hidden">
      <button
        type="button"
        onClick={() => toggle(s.id)}
        className="w-full p-5 text-left"
        aria-expanded={isOpen ? "true" : "false"}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <span
              className={`mt-0.5 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
            >
              <ChevronRight className="size-4 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="font-display text-base font-bold truncate min-w-0 max-w-full">{s.title}</span>
                {s.status === "grading" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 text-warning border border-warning/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0">
                    <Clock className="size-3" /> Needs Grading
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span>
                  {[s.categoryName, s.subcategoryName].filter(Boolean).join(" → ") ||
                    t("hist.uncategorised")}
                </span>
                {s.topic && (
                  <>
                    <span>·</span>
                    <span className="text-primary/80">{quizTypeLabel}</span>
                  </>
                )}
                <span>·</span>
                <span>{new Date(s.created_at).toLocaleDateString()}</span>
              </div>
              {submitted.length > 0 && (
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden max-w-[160px]">
                    <div
                      className={`h-full rounded-full transition-all ${s.status === "grading" ? "bg-warning/50" : avgBarColor} ${
                        avgPct <= 10
                          ? "w-[10%]"
                          : avgPct <= 20
                            ? "w-1/5"
                            : avgPct <= 25
                              ? "w-1/4"
                              : avgPct <= 33
                                ? "w-1/3"
                                : avgPct <= 50
                                  ? "w-1/2"
                                  : avgPct <= 66
                                    ? "w-2/3"
                                    : avgPct <= 75
                                      ? "w-3/4"
                                      : avgPct <= 90
                                        ? "w-[90%]"
                                        : "w-full"
                      }`}
                    />
                  </div>
                  <span
                    className={`text-xs font-bold ${s.status === "grading" ? "text-warning" : avgColor}`}
                  >
                    {s.avgScore} pts
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.status === "grading" ? "avg (partial)" : "avg"}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex flex-col items-end gap-1">
              <span className="text-xs text-muted-foreground">{submitted.length} submitted</span>
              {top && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
                  <Crown className="size-3" />
                  <span className="truncate max-w-[100px]">{top.name}</span>
                  <span className="text-success font-bold ml-1">{top.score}pts</span>
                </span>
              )}
            </div>
            {s.status === "grading" ? (
              <span className="rounded-full px-2.5 py-1 text-xs font-bold border bg-warning/10 text-warning border-warning/25">
                Pending
              </span>
            ) : (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold border ${
                  avgPct >= 70
                    ? "bg-success/10 text-success border-success/25"
                    : avgPct >= 40
                      ? "bg-warning/10 text-warning border-warning/25"
                      : submitted.length === 0
                        ? "bg-muted/20 text-muted-foreground border-border"
                        : "bg-destructive/10 text-destructive border-destructive/25"
                }`}
              >
                {submitted.length === 0
                  ? "No data"
                  : avgPct >= 70
                    ? "Good"
                    : avgPct >= 40
                      ? "Fair"
                      : "Low"}
              </span>
            )}
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-border" id={`history-report-${s.id}`}>
          {isLoadingExpand && (
            <div className="p-4 text-xs text-muted-foreground animate-pulse">
              {t("hist.loadingReport")}
            </div>
          )}
          <div className="p-4 bg-muted/10 flex flex-wrap items-start justify-between gap-3 print:hidden">
            <div className="space-y-1 min-w-0">
              <p className="text-xs font-semibold">{t("hist.finalReport")}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>
                  {t("hist.teacher")}:{" "}
                  <span className="text-foreground font-medium">{teacherName}</span>
                </span>
                {schoolName && (
                  <span>
                    {t("hist.school")}:{" "}
                    <span className="text-foreground font-medium">{schoolName}</span>
                  </span>
                )}
                <span>
                  {t("hist.type")}:{" "}
                  <span className="text-foreground font-medium">{quizTypeLabel}</span>
                </span>
                <span>
                  {t("hist.subject")}:{" "}
                  <span className="text-foreground font-medium">{subjectLabel(s)}</span>
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap" ref={downloadRef}>
              {s.status === "grading" && (
                <Button
                  size="sm"
                  onClick={() =>
                    void navigate({ to: "/sessions/$sessionId/grade", params: { sessionId: s.id } })
                  }
                  className="gap-1.5 bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25"
                >
                  <PenLine className="size-3.5" /> Grade Now
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                <Printer className="size-3.5" /> {t("hist.print")}
              </Button>
              <div className="relative">
                <Button
                  size="sm"
                  onClick={() => setDownloadOpenId(downloadOpenId === s.id ? null : s.id)}
                  className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow"
                >
                  <Download className="size-3.5" /> {t("hist.download")}{" "}
                  <ChevronDown className="size-3 ml-0.5" />
                </Button>
                {downloadOpenId === s.id && (
                  <div className="absolute right-0 mt-1 w-40 rounded-xl border border-border bg-card shadow-card z-10 overflow-hidden">
                    <button
                      type="button"
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-sidebar-accent transition-colors"
                      onClick={() => {
                        setDownloadOpenId(null);
                        downloadQuizReportCsv(
                          {
                            title: s.title,
                            categoryLabel: [s.categoryName, s.subcategoryName]
                              .filter(Boolean)
                              .join(" -> "),
                            teacherName,
                            schoolName,
                            subjectLabel: subjectLabel(s),
                            topicLabel: quizTypeLabel,
                            createdAt: s.created_at,
                            questionCount: fullAttempts[0]?.total_questions ?? 0,
                            attempts: fullAttempts.map((a) =>
                              toReportAttempt(a, sessionMaxPts[s.id]),
                            ),
                          },
                          { watermark: plan?.file_export_watermark !== false },
                        );
                      }}
                    >
                      <FileSpreadsheet className="size-3.5 text-success" /> Excel (CSV)
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-sidebar-accent transition-colors"
                      onClick={() => {
                        setDownloadOpenId(null);
                        handlePrint();
                      }}
                    >
                      <FileText className="size-3.5 text-primary" /> PDF (Print)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {submitted.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">{t("hist.noParticipants")}</p>
          ) : (
            <div className="p-4 space-y-2">
              {submitted.length >= 2 && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {submitted.slice(0, 3).map((a, i) => {
                    const medals = [
                      {
                        bg: "bg-yellow-500/15 border-yellow-500/30",
                        text: "text-yellow-600",
                        label: "🥇 1st",
                      },
                      {
                        bg: "bg-slate-400/15 border-slate-400/30",
                        text: "text-slate-500",
                        label: "🥈 2nd",
                      },
                      {
                        bg: "bg-orange-400/15 border-orange-400/30",
                        text: "text-orange-600",
                        label: "🥉 3rd",
                      },
                    ];
                    const m = medals[i] ?? medals[2];
                    return (
                      <div key={a.id} className={`rounded-xl border p-3 text-center ${m.bg}`}>
                        <div className={`text-[10px] font-bold uppercase tracking-wider ${m.text}`}>
                          {m.label}
                        </div>
                        <div className="mt-1 text-sm font-bold truncate">{a.name}</div>
                        <div className={`text-lg font-bold ${m.text}`}>
                          {a.score}
                          <span className="text-xs font-normal text-muted-foreground">
                            /{a.totalMaxPoints ?? a.totalQuestions}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {a.percent}% · {a.totalMaxPoints ?? a.totalQuestions} pts total
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <ol className="space-y-1.5">
                {
                  // eslint-disable-next-line sonarjs/cognitive-complexity -- attempt row render with many conditional display branches
                  visibleSubmitted.map((a) => {
                    const stats = attemptAnswerStats[s.id]?.[a.id];
                    const attempted = stats?.attempted ?? a.attemptedQuestions;
                    const skipped = Math.max(0, a.totalQuestions - attempted);
                    const scorePct = Math.round((a.score / Math.max(1, maxScore)) * 100);
                    const rankColors = [
                      "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
                      "bg-slate-400/20 text-slate-600 border-slate-400/30",
                      "bg-orange-400/20 text-orange-600 border-orange-400/30",
                    ];
                    const rankClass =
                      a.rank <= 3
                        ? rankColors[a.rank - 1]
                        : "bg-primary/10 text-primary border-primary/20";

                    return (
                      <li
                        key={a.id}
                        className="rounded-xl bg-secondary/40 hover:bg-secondary/60 px-3 py-2.5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${rankClass}`}
                          >
                            {a.rank}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-semibold text-sm truncate">{a.name}</div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <div
                                  className={`text-sm font-bold ${s.status === "grading" ? "text-warning" : "text-success"}`}
                                >
                                  {a.score}
                                  <span className="text-[10px] text-muted-foreground font-normal">
                                    /{a.totalMaxPoints ?? a.totalQuestions}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground font-normal ml-0.5">
                                    pts
                                  </span>
                                  {s.status === "grading" && (
                                    <span className="text-[10px] text-warning font-medium ml-1">
                                      (partial)
                                    </span>
                                  )}
                                </div>
                                <div
                                  className={`text-[10px] font-mono ${s.status === "grading" ? "text-warning/70" : "text-muted-foreground"}`}
                                >
                                  {a.percent}%
                                </div>
                              </div>
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                              <div
                                className={`h-full rounded-full bg-success/60 transition-all ${
                                  scorePct <= 10
                                    ? "w-[10%]"
                                    : scorePct <= 20
                                      ? "w-1/5"
                                      : scorePct <= 25
                                        ? "w-1/4"
                                        : scorePct <= 33
                                          ? "w-1/3"
                                          : scorePct <= 50
                                            ? "w-1/2"
                                            : scorePct <= 66
                                              ? "w-2/3"
                                              : scorePct <= 75
                                                ? "w-3/4"
                                                : scorePct <= 90
                                                  ? "w-[90%]"
                                                  : "w-full"
                                }`}
                              />
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.status === "grading" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}
                              >
                                {a.score}/{a.totalMaxPoints ?? a.totalQuestions} pts · {a.percent}%
                                {s.status === "grading" ? " (partial)" : ""}
                              </span>
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-muted/40 text-muted-foreground px-2 py-0.5 text-[10px] font-semibold">
                                {attempted}/{a.totalQuestions} attempted
                              </span>
                              {skipped > 0 && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-muted/40 text-muted-foreground px-2 py-0.5 text-[10px] font-semibold">
                                  - {skipped} skipped
                                </span>
                              )}
                              {a.email && (
                                <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                  {a.email}
                                </span>
                              )}
                              {a.rollNumber && (
                                <span className="text-[10px] text-muted-foreground">
                                  {t("hist.rollN")} {a.rollNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })
                }
              </ol>
              <PaginationControls
                page={attemptPage}
                pageSize={HISTORY_PAGE_SIZE}
                total={submitted.length}
                label="participants"
                onPageChange={(nextPage) =>
                  setAttemptPages((current) => ({ ...current, [s.id]: nextPage }))
                }
              />
            </div>
          )}
        </div>
      )}
    </li>
  );
}
