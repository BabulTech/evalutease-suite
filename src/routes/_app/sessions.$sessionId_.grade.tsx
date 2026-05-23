import React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { useGradePage } from "./sessions.$sessionId_.grade/useGradePage";
import { ModeSelect } from "./sessions.$sessionId_.grade/ModeSelect";
import { ManualMode } from "./sessions.$sessionId_.grade/ManualMode";
import { AiSetup } from "./sessions.$sessionId_.grade/AiSetup";
import { AiReview } from "./sessions.$sessionId_.grade/AiReview";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/_app/sessions/$sessionId_/grade")({
  component: GradePage,
});

// react-doctor-disable-next-line react-doctor/only-export-components
function GradePage() {
  const { sessionId } = Route.useParams();
  const {
    answers,
    loading,
    sessionTitle,
    sessionStatus,
    mode,
    setMode,
    questionIndex,
    setQuestionIndex,
    rowGrades,
    setRowGrades,
    savingAll,
    unlockedIds,
    overlay,
    criteria,
    setCriteria,
    aiRunning,
    aiProgress,
    aiReviewItems,
    setAiReviewItems,
    savingReview,
    finalizing,
    creditCostShort,
    creditCostLong,
    credits,
    pending,
    graded,
    totalCost,
    questionGroups,
    isUnsavedForUI,
    getRowGrade,
    handleGraded,
    handleEditGrade,
    handleSaveAllGrades,
    handleFinalize,
    handleRunAi,
    runAiGrade,
    confirmAiReview,
  } = useGradePage(sessionId);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/sessions/$sessionId" params={{ sessionId }}>
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-semibold truncate">Grading</h1>
            <p className="text-sm text-muted-foreground truncate">{sessionTitle}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            <Users className="size-4" />
            <span>
              {graded.length}/{answers.length} graded
            </span>
          </div>
        </div>

        {answers.length > 0 && (
          <div className="rounded-xl border border-border bg-card/40 px-5 py-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>{graded.length} graded</span>
              <span>{pending.length} pending</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="pct-bar h-full rounded-full bg-gradient-primary transition-all"
                style={
                  {
                    "--pct": `${answers.length ? (graded.length / answers.length) * 100 : 0}%`,
                  } as React.CSSProperties
                }
              />
            </div>
          </div>
        )}

        {answers.length === 0 && (
          <div className="rounded-2xl border border-border bg-card/40 p-10 text-center">
            <p className="text-muted-foreground">No typed answers to grade.</p>
          </div>
        )}

        {answers.length > 0 && mode === "select" && (
          <ModeSelect
            pendingCount={pending.length}
            totalCost={totalCost}
            sessionStatus={sessionStatus}
            finalizing={finalizing}
            onManual={() => {
              setMode("manual");
              setQuestionIndex(0);
            }}
            onAiSetup={() => setMode("ai-setup")}
            onFinalize={() => void handleFinalize()}
          />
        )}

        {mode === "manual" && (
          <ManualMode
            sessionId={sessionId}
            sessionStatus={sessionStatus}
            questionGroups={questionGroups}
            questionIndex={questionIndex}
            setQuestionIndex={setQuestionIndex}
            rowGrades={rowGrades}
            setRowGrades={setRowGrades}
            savingAll={savingAll}
            unlockedIds={unlockedIds}
            pendingCount={pending.length}
            finalizing={finalizing}
            creditCostShort={creditCostShort}
            creditCostLong={creditCostLong}
            creditBalance={credits.balance}
            isUnsavedForUI={isUnsavedForUI}
            getRowGrade={getRowGrade}
            handleGraded={handleGraded}
            handleEditGrade={handleEditGrade}
            handleSaveAllGrades={handleSaveAllGrades}
            handleFinalize={handleFinalize}
            handleRunAi={handleRunAi}
            onBack={() => setMode("select")}
          />
        )}

        {mode === "ai-setup" && (
          <AiSetup
            pendingCount={pending.length}
            totalCost={totalCost}
            creditBalance={credits.balance}
            criteria={criteria}
            onCriteriaChange={setCriteria}
            onBack={() => setMode("select")}
            onRun={() => void runAiGrade()}
          />
        )}

        {(mode === "ai-review" || mode === "ai-running") && (
          <AiReview
            sessionId={sessionId}
            aiReviewItems={aiReviewItems}
            setAiReviewItems={setAiReviewItems}
            savingReview={savingReview}
            aiRunning={aiRunning}
            aiProgress={aiProgress}
            onConfirm={() => void confirmAiReview()}
          />
        )}
      </div>

      <LoadingOverlay
        visible={overlay.visible}
        variant="driven"
        title={overlay.title}
        steps={overlay.steps}
        currentStep={overlay.step}
        hint={overlay.hint}
      />
    </div>
  );
}
