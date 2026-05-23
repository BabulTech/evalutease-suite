import { useEffect, useState } from "react";
import { ChevronRight, Loader2, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDuration, type QuizReportRow } from "@/lib/quiz-reports";
import { supabase } from "@/integrations/supabase/client";
import { PaginationControls } from "@/components/PaginationControls";
import { paginate } from "@/lib/pagination";
import { REPORT_PAGE_SIZE } from "./types";
import type { AttemptAnswer } from "./types";
import { AnswerCard, ResultBadge } from "./ReportUi";

export function AttemptsTable({ rows, passMark }: { rows: QuizReportRow[]; passMark: number }) {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingAnswers, setLoadingAnswers] = useState<string | null>(null);
  const [attemptAnswers, setAttemptAnswers] = useState<Record<string, AttemptAnswer[]>>({});
  const visibleRows = paginate(rows, page, REPORT_PAGE_SIZE);

  // react-doctor-disable-next-line react-doctor/no-derived-state-effect
  // react-doctor-disable-next-line react-doctor/no-adjust-state-on-prop-change
  // react-doctor-disable-next-line react-doctor/no-derived-state-effect
  useEffect(() => {
    setPage(0);
  }, [rows]);

  const toggleExpand = async (attemptId: string) => {
    if (expandedId === attemptId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(attemptId);
    if (attemptAnswers[attemptId]) return;
    setLoadingAnswers(attemptId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ansData, error: ansErr } = await (supabase as any)
      .from("quiz_answers")
      .select("id, question_id, answer, points_awarded, is_correct, graded_at")
      .eq("attempt_id", attemptId);
    setLoadingAnswers(null);
    if (ansErr || !ansData || ansData.length === 0) {
      setAttemptAnswers((prev) => ({ ...prev, [attemptId]: [] }));
      return;
    }
    const qIds = (ansData as { question_id: string }[]).map((r) => r.question_id);
    const { data: qData } = await supabase
      .from("questions")
      .select("id, text, type, max_points")
      .in("id", qIds);
    const qMap = Object.fromEntries((qData ?? []).map((q) => [q.id, q]));
    setAttemptAnswers((prev) => ({
      ...prev,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [attemptId]: (ansData as any[]).map((r: any, idx: number) => ({
        id: r.id,
        attempt_id: attemptId,
        question_id: r.question_id,
        question_text: qMap[r.question_id]?.text ?? `Q${idx + 1}`,
        question_type: qMap[r.question_id]?.type ?? "mcq",
        answer: r.answer,
        points_awarded: r.points_awarded,
        max_points: qMap[r.question_id]?.max_points ?? 1,
        is_correct: r.is_correct,
        graded_at: r.graded_at,
        model_answer: null,
        rubric: null,
      })),
    }));
  };

  return (
    <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
      {rows.length === 0 ? (
        <div className="p-10 text-center">
          <Users className="mx-auto size-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium">{t("rep.noParticipantsMatch")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("rep.tryChangingFilters")}</p>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {visibleRows.map((row) => {
            const isExpanded = expandedId === row.id;
            const answers = attemptAnswers[row.id] ?? [];
            return (
              <div key={row.id}>
                <button
                  type="button"
                  onClick={() => void toggleExpand(row.id)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/10 transition-colors flex items-center gap-3"
                >
                  <span
                    className={`shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                  >
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </span>
                  <span className="w-6 shrink-0 text-xs font-bold text-muted-foreground">
                    {row.rank}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="font-semibold text-sm block truncate">{row.name}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {row.email || t("rep.noEmail")}
                      {row.rollNumber ? ` · Roll: ${row.rollNumber}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-4 shrink-0 text-sm">
                    <span className="font-bold text-success">
                      {row.score}
                      <span className="text-xs text-muted-foreground font-normal">
                        /{row.totalMaxPoints ?? row.totalQuestions}
                      </span>
                      <span className="text-xs text-muted-foreground font-normal ml-1">pts</span>
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">{row.percent}%</span>
                    <ResultBadge row={row} passMark={passMark} />
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {formatDuration(row.durationSeconds ?? null)}
                    </span>
                  </span>
                </button>
                {isExpanded && (
                  <div className="bg-muted/5 border-t border-border/40 px-4 py-3">
                    {loadingAnswers === row.id ? (
                      <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" /> Loading answers…
                      </div>
                    ) : answers.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        No answers found for this attempt.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {answers.map((a, idx) => (
                          <AnswerCard key={a.id} a={a} i={idx} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="px-4 py-2 border-t border-border/40 text-xs text-muted-foreground">
        {rows.length}{" "}
        {rows.length !== 1 ? t("rep.participantsMatched") : t("rep.participantMatched")} · Click a
        row to see per-question answers
      </div>
      <PaginationControls
        page={page}
        pageSize={REPORT_PAGE_SIZE}
        total={rows.length}
        label="participants"
        onPageChange={setPage}
      />
    </div>
  );
}
