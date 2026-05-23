import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  PenLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnswerRow } from "./AnswerRow";
import type { AiResult, GradeAnswer, QuestionGroup, RowGrade } from "./types";

export function ManualMode({
  sessionId,
  sessionStatus,
  questionGroups,
  questionIndex,
  setQuestionIndex,
  rowGrades: _rowGrades,
  setRowGrades,
  savingAll,
  unlockedIds,
  pendingCount,
  finalizing,
  creditCostShort,
  creditCostLong,
  creditBalance,
  isUnsavedForUI,
  getRowGrade,
  handleGraded,
  handleEditGrade,
  handleSaveAllGrades,
  handleFinalize,
  handleRunAi,
  onBack,
}: {
  sessionId: string;
  sessionStatus: string;
  questionGroups: QuestionGroup[];
  questionIndex: number;
  setQuestionIndex: (i: number | ((prev: number) => number)) => void;
  rowGrades: Record<string, RowGrade>;
  setRowGrades: (fn: (prev: Record<string, RowGrade>) => Record<string, RowGrade>) => void;
  savingAll: boolean;
  unlockedIds: Set<string>;
  pendingCount: number;
  finalizing: boolean;
  creditCostShort: number;
  creditCostLong: number;
  creditBalance: number;
  isUnsavedForUI: (a: GradeAnswer) => boolean;
  getRowGrade: (a: GradeAnswer) => RowGrade;
  handleGraded: (id: string, pts: number, comment: string) => Promise<void>;
  handleEditGrade: (a: GradeAnswer) => void;
  handleSaveAllGrades: (answers: GradeAnswer[]) => Promise<void>;
  handleFinalize: () => Promise<void>;
  handleRunAi: (answer: GradeAnswer, criteriaNote: string) => Promise<AiResult>;
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const currentGroup = questionGroups[questionIndex];
  if (!currentGroup) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground">
          <ArrowLeft className="size-3.5" /> Back
        </Button>
        <span className="text-sm font-semibold text-muted-foreground">
          Question {questionIndex + 1} of {questionGroups.length}
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={questionIndex === 0}
            onClick={() => setQuestionIndex((i) => i - 1)}
            className="gap-1"
          >
            <ArrowLeft className="size-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={questionIndex === questionGroups.length - 1}
            onClick={() => setQuestionIndex((i) => i + 1)}
            className="gap-1"
          >
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/15 text-primary border-0 text-xs uppercase tracking-wider">
            {currentGroup.question_type === "long_answer" ? "Long Answer" : "Short Answer"}
          </Badge>
          <span className="text-xs text-muted-foreground">{currentGroup.max_points} pts max</span>
        </div>
        <p className="font-semibold text-foreground leading-relaxed">
          {currentGroup.question_text}
        </p>
        {currentGroup.model_answer && (
          <details className="group">
            <summary className="cursor-pointer list-none flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground select-none">
              <ChevronDown className="size-3.5 group-open:hidden" />
              <ChevronUp className="size-3.5 hidden group-open:block" />
              Show model answer
            </summary>
            <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary/90 whitespace-pre-wrap leading-relaxed">
              {currentGroup.model_answer}
            </div>
          </details>
        )}
        {currentGroup.rubric && (
          <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Rubric
            </div>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {currentGroup.rubric}
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Student names are hidden for fair grading ·{" "}
        {currentGroup.answers.filter((a) => a.graded_at !== null && !unlockedIds.has(a.id)).length}/
        {currentGroup.answers.length} graded
      </p>

      <div className="space-y-4">
        {currentGroup.answers.map((a, i) => (
          <AnswerRow
            key={a.id}
            answer={a}
            index={i}
            grade={getRowGrade(a)}
            onGradeChange={(g) => setRowGrades((prev) => ({ ...prev, [a.id]: g }))}
            saving={savingAll}
            onGraded={handleGraded}
            onRunAi={handleRunAi}
            creditCost={a.question_type === "long_answer" ? creditCostLong : creditCostShort}
            canAffordAi={
              creditBalance >=
              (a.question_type === "long_answer" ? creditCostLong : creditCostShort)
            }
            isUnlocked={unlockedIds.has(a.id)}
            onEditGrade={() => handleEditGrade(a)}
          />
        ))}
      </div>

      {currentGroup.answers.some(isUnsavedForUI) && (
        <Button
          onClick={() => void handleSaveAllGrades(currentGroup.answers)}
          disabled={savingAll}
          className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
        >
          {savingAll ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {savingAll
            ? "Saving…"
            : `Save Grades (${currentGroup.answers.filter(isUnsavedForUI).length} answers)`}
        </Button>
      )}

      {questionIndex < questionGroups.length - 1 && (
        <Button
          onClick={() => setQuestionIndex((i) => i + 1)}
          className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
        >
          Next Question <ArrowRight className="size-4" />
        </Button>
      )}

      {questionIndex === questionGroups.length - 1 && pendingCount === 0 && (
        <div className="rounded-2xl border border-success/30 bg-success/5 p-5 text-center space-y-4">
          <CheckCircle2 className="size-10 text-success mx-auto" />
          <div>
            <p className="font-semibold">All answers graded!</p>
            <p className="text-xs text-muted-foreground mt-1">
              Review the marks once more or finalize the session.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {sessionStatus === "grading" && (
              <Button
                onClick={() => void handleFinalize()}
                disabled={finalizing}
                className="gap-2 bg-gradient-primary text-primary-foreground"
              >
                {finalizing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Finalize &amp; Close Session
              </Button>
            )}
            <Button variant="outline" onClick={() => setQuestionIndex(0)} className="gap-2">
              <PenLine className="size-4" /> Review marks from the start
            </Button>
            <Button
              variant="ghost"
              onClick={() => void navigate({ to: "/sessions/$sessionId", params: { sessionId } })}
              className="gap-2"
            >
              Back to Session
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
