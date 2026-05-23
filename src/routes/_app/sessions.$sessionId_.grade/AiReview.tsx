import React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AiReviewItem } from "./types";

export function AiReview({
  sessionId,
  aiReviewItems,
  setAiReviewItems,
  savingReview,
  aiRunning,
  aiProgress,
  onConfirm,
}: {
  sessionId: string;
  aiReviewItems: AiReviewItem[];
  setAiReviewItems: React.Dispatch<React.SetStateAction<AiReviewItem[]>>;
  savingReview: boolean;
  aiRunning: boolean;
  aiProgress: number;
  onConfirm: () => void;
}) {
  const navigate = useNavigate();

  if (aiReviewItems.length > 0) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> Review AI Marks
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              AI suggested these marks. Adjust any before saving.
            </p>
          </div>
          <Button
            onClick={onConfirm}
            disabled={savingReview}
            className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {savingReview ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            Confirm & Save All
          </Button>
        </div>

        <div className="space-y-3">
          {aiReviewItems.map((item, idx) => (
            <div
              key={item.answer.id}
              className="rounded-2xl border border-primary/20 bg-card/60 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase rounded bg-muted/60 px-1.5 py-0.5 text-muted-foreground">
                      {item.answer.question_type === "long_answer" ? "Long" : "Short"}
                    </span>
                    <span className="text-xs text-muted-foreground">Q{idx + 1}</span>
                  </div>
                  <p className="text-sm font-medium leading-snug">{item.answer.question_text}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setAiReviewItems((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? { ...x, adjustedPoints: Math.max(0, x.adjustedPoints - 1) }
                            : x,
                        ),
                      )
                    }
                    className="size-7 rounded-lg border border-border hover:bg-muted/40 flex items-center justify-center text-sm font-bold transition-colors"
                  >
                    −
                  </button>
                  <span className="text-sm font-bold w-8 text-center">
                    {item.adjustedPoints}
                    <span className="text-xs text-muted-foreground font-normal">
                      /{item.answer.max_points}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAiReviewItems((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? {
                                ...x,
                                adjustedPoints: Math.min(x.answer.max_points, x.adjustedPoints + 1),
                              }
                            : x,
                        ),
                      )
                    }
                    className="size-7 rounded-lg border border-border hover:bg-muted/40 flex items-center justify-center text-sm font-bold transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="rounded-lg bg-muted/20 border border-border px-3 py-2 text-xs text-foreground">
                {item.answer.answer_text || (
                  <span className="italic text-muted-foreground">No answer submitted</span>
                )}
              </div>
              <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <Sparkles className="size-3 mt-0.5 shrink-0 text-primary/60" />
                <span>{item.result.reasoning}</span>
              </div>
              {item.adjustedPoints !== item.result.points && (
                <div className="text-[11px] text-warning">
                  AI suggested {item.result.points}/{item.answer.max_points} · you changed to{" "}
                  {item.adjustedPoints}
                </div>
              )}
            </div>
          ))}
        </div>

        <Button
          onClick={onConfirm}
          disabled={savingReview}
          className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
        >
          {savingReview ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Confirm & Save All {aiReviewItems.length} Marks
        </Button>
      </div>
    );
  }

  // ai-running state
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-10 text-center space-y-5">
      <div className="size-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto shadow-glow">
        <Sparkles className="size-8 text-primary-foreground animate-pulse" />
      </div>
      <div>
        <h2 className="font-display text-xl font-semibold">AI Grading in Progress</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Please wait while AI reviews all answers…
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{aiProgress}%</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div
            className="pct-bar h-full rounded-full bg-gradient-primary transition-all duration-300"
            style={{ "--pct": `${aiProgress}%` } as React.CSSProperties}
          />
        </div>
      </div>
      {!aiRunning && (
        <Button
          onClick={() => void navigate({ to: "/sessions/$sessionId", params: { sessionId } })}
          className="gap-2 bg-gradient-primary text-primary-foreground"
        >
          Back to Session
        </Button>
      )}
    </div>
  );
}
