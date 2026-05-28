import { Link, useNavigate } from "@tanstack/react-router";
import { Coins, PenLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GradingBanner({
  sessionId,
  gradingSummary,
  shortCreditCost,
  longCreditCost,
  totalGradingCost,
  creditBalance,
  bulkAiRunning,
  showGradeConfirm,
  onShowConfirm,
  onHideConfirm,
  onBulkAiGrade,
}: {
  sessionId: string;
  gradingSummary: { short: number; long: number };
  shortCreditCost: number;
  longCreditCost: number;
  totalGradingCost: number;
  creditBalance: number;
  bulkAiRunning: boolean;
  showGradeConfirm: boolean;
  onShowConfirm: () => void;
  onHideConfirm: () => void;
  onBulkAiGrade: () => void;
}) {
  const navigate = useNavigate();

  return (
    <>
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4 print:hidden">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <PenLine className="size-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">Answers need grading</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {[
                gradingSummary.short > 0 &&
                  `${gradingSummary.short} short answer${gradingSummary.short > 1 ? "s" : ""}`,
                gradingSummary.long > 0 &&
                  `${gradingSummary.long} long answer${gradingSummary.long > 1 ? "s" : ""}`,
              ]
                .filter(Boolean)
                .join(" · ")}{" "}
              still need to be graded.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/50 divide-y divide-border text-sm">
          {gradingSummary.short > 0 && (
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-muted-foreground">
                Short answers ({gradingSummary.short} × {shortCreditCost} cr)
              </span>
              <span className="font-semibold">
                {gradingSummary.short * shortCreditCost} credits
              </span>
            </div>
          )}
          {gradingSummary.long > 0 && (
            <div className="flex justify-between px-4 py-2.5">
              <span className="text-muted-foreground">
                Long answers ({gradingSummary.long} × {longCreditCost} cr)
              </span>
              <span className="font-semibold">{gradingSummary.long * longCreditCost} credits</span>
            </div>
          )}
          <div className="flex justify-between px-4 py-2.5 font-bold">
            <span>Total for AI grading</span>
            <span className="text-primary">{totalGradingCost} credits</span>
          </div>
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-muted-foreground">Your balance</span>
            <span
              className={
                creditBalance >= totalGradingCost
                  ? "text-success font-semibold"
                  : "text-destructive font-semibold"
              }
            >
              {creditBalance} credits
            </span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
            disabled={bulkAiRunning || creditBalance < totalGradingCost}
            onClick={onShowConfirm}
          >
            {bulkAiRunning ? (
              <>
                <Sparkles className="size-4 animate-pulse" /> Grading…
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Grade with AI ({totalGradingCost} credits)
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() =>
              void navigate({ to: "/sessions/$sessionId/grade", params: { sessionId } })
            }
          >
            <PenLine className="size-4" /> Grade Manually
          </Button>
        </div>

        {creditBalance < totalGradingCost && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <Coins className="size-3.5" />
            Not enough credits for AI grading.{" "}
            <Link to="/billing" search={{ plan: "" }} className="underline font-semibold">
              Buy more →
            </Link>{" "}
            or grade manually.
          </p>
        )}
      </div>

      {showGradeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-primary to-purple-500" />
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="size-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Confirm AI Grading</p>
                  <p className="text-xs text-muted-foreground">
                    This will use {totalGradingCost} credits
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Claude AI will review and score all {gradingSummary.short + gradingSummary.long}{" "}
                answers. Results will be saved immediately. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={onHideConfirm}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-gradient-primary text-primary-foreground shadow-glow gap-1.5"
                  onClick={onBulkAiGrade}
                >
                  <Sparkles className="size-4" /> Confirm & Grade
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
