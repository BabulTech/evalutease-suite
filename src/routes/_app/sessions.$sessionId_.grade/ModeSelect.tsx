import { CheckCircle2, Loader2, PenLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ModeSelect({
  pendingCount,
  totalCost,
  sessionStatus,
  finalizing,
  onManual,
  onAiSetup,
  onFinalize,
}: {
  pendingCount: number;
  totalCost: number;
  sessionStatus: string;
  finalizing: boolean;
  onManual: () => void;
  onAiSetup: () => void;
  onFinalize: () => void;
}) {
  if (pendingCount === 0 && sessionStatus === "grading") {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-5 text-center space-y-4 mb-4">
        <CheckCircle2 className="size-10 text-success mx-auto" />
        <div>
          <p className="font-semibold">All answers graded!</p>
          <p className="text-xs text-muted-foreground mt-1">
            Review your marks before closing, or finalize the session now.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button variant="outline" onClick={onManual} className="gap-2">
            <PenLine className="size-4" /> Review marks
          </Button>
          <Button
            onClick={onFinalize}
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
        </div>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          How do you want to grade the answers?
        </p>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={onManual}
            className="rounded-2xl border-2 border-border bg-card/60 hover:border-primary/60 hover:bg-primary/5 p-6 text-left space-y-2 transition-all group"
          >
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <PenLine className="size-6 text-primary" />
            </div>
            <div className="font-semibold">Grade Manually</div>
            <p className="text-xs text-muted-foreground">
              Review each answer yourself. Use AI on individual answers anytime.
            </p>
          </button>
          <button
            type="button"
            onClick={onAiSetup}
            className="rounded-2xl border-2 border-border bg-card/60 hover:border-primary/60 hover:bg-primary/5 p-6 text-left space-y-2 transition-all group"
          >
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Sparkles className="size-6 text-primary" />
            </div>
            <div className="font-semibold">Grade All with AI</div>
            <p className="text-xs text-muted-foreground">
              Set criteria once, AI grades all {pendingCount} answers. ({totalCost} credits)
            </p>
          </button>
        </div>
      </div>
    );
  }

  return null;
}
