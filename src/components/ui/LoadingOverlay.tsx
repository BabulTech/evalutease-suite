import { useEffect, useState } from "react";
import { Sparkles, Brain, FileText, CheckCircle2, Wand2, Loader2 } from "lucide-react";

export type Step = { icon?: React.ReactNode; label: string; detail?: string };

const AI_STEPS: Step[] = [
  {
    icon: <Brain className="size-5" />,
    label: "Understanding your topic",
    detail: "Analysing subject matter and context…",
  },
  {
    icon: <Sparkles className="size-5" />,
    label: "Generating questions",
    detail: "Claude AI is crafting unique questions…",
  },
  {
    icon: <FileText className="size-5" />,
    label: "Structuring answers",
    detail: "Adding correct answers and distractors…",
  },
  {
    icon: <CheckCircle2 className="size-5" />,
    label: "Reviewing quality",
    detail: "Checking accuracy and formatting…",
  },
  {
    icon: <Wand2 className="size-5" />,
    label: "Almost ready",
    detail: "Wrapping up your question set…",
  },
];

type Props = {
  visible: boolean;
  /**
   * - "ai": time-based auto-advance through the canonical AI generation steps.
   * - "generic": single spinner with `message`.
   * - "driven": caller supplies `steps` + `currentStep` so the UI reflects actual progress.
   */
  variant?: "ai" | "generic" | "driven";
  message?: string;
  /** Driven mode: list of steps to display. */
  steps?: Step[];
  /** Driven mode: zero-based index of the currently running step. Use `steps.length` to mark all done. */
  currentStep?: number;
  /** Driven mode: title shown at the top (default: "Working…"). */
  title?: string;
  /** Driven mode: small hint shown under the title. */
  hint?: string;
};

export function LoadingOverlay({
  visible,
  variant = "ai",
  message,
  steps,
  currentStep = 0,
  title,
  hint,
}: Props) {
  const [aiStepIdx, setAiStepIdx] = useState(0);
  const [dots, setDots] = useState("");

  // react-doctor-disable-next-line react-doctor/no-cascading-set-state
  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-adjust-state-on-prop-change
    if (!visible) {
      setAiStepIdx(0);
      return;
    }

    const dotTimer = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);

    if (variant === "ai") {
      const stepTimer = setInterval(() => {
        setAiStepIdx((i) => Math.min(i + 1, AI_STEPS.length - 1));
      }, 3000);
      return () => {
        clearInterval(stepTimer);
        clearInterval(dotTimer);
      };
    }

    return () => {
      clearInterval(dotTimer);
    };
  }, [visible, variant]);

  if (!visible) return null;

  if (variant === "generic") {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-10 py-8 shadow-2xl">
          <div className="size-10 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm font-medium text-foreground">{message ?? "Please wait…"}</p>
        </div>
      </div>
    );
  }

  // Resolve which step list + active index we're rendering
  const isDriven = variant === "driven" && steps && steps.length > 0;
  const renderSteps = isDriven ? steps! : AI_STEPS;
  const activeIdx = isDriven ? Math.min(currentStep, renderSteps.length) : aiStepIdx;
  const allDone = isDriven && currentStep >= renderSteps.length;
  const headline = isDriven ? (title ?? "Working") : "AI is working";
  const subhint = isDriven
    ? (hint ?? `Step ${Math.min(activeIdx + 1, renderSteps.length)} of ${renderSteps.length}`)
    : "This usually takes 10–30 seconds";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/85 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-primary/30 bg-card shadow-2xl overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-purple-500 to-primary bg-[length:200%_100%] animate-shimmer" />

        <div className="px-7 py-8 space-y-6">
          {/* Icon + headline */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative flex items-center justify-center size-16 rounded-2xl bg-primary/10 border border-primary/25">
              {allDone ? (
                <CheckCircle2 className="size-8 text-success" />
              ) : (
                <Sparkles className="size-8 text-primary animate-pulse" />
              )}
              {!allDone && (
                <span className="absolute inset-0 rounded-2xl border-2 border-primary/20 animate-ping" />
              )}
            </div>
            <div>
              <p className="font-display font-bold text-lg text-foreground">
                {headline}
                {allDone ? "" : dots}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{subhint}</p>
            </div>
          </div>

          {/* Step list */}
          <div className="space-y-2.5">
            {renderSteps.map((step, i) => {
              const done = i < activeIdx;
              const active = i === activeIdx && !allDone;
              return (
                <div
                  key={step.label ?? i}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-500 ${
                    active
                      ? "bg-primary/10 border border-primary/25"
                      : done
                        ? "opacity-50"
                        : "opacity-30"
                  }`}
                >
                  <span
                    className={`shrink-0 ${active ? "text-primary" : done ? "text-success" : "text-muted-foreground"}`}
                  >
                    {done ? (
                      <CheckCircle2 className="size-5" />
                    ) : (
                      (step.icon ?? (
                        <Loader2 className={`h-5 w-5 ${active ? "animate-spin" : ""}`} />
                      ))
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold leading-none ${active ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {step.label}
                    </p>
                    {(active || done) && step.detail && (
                      <p className="text-xs text-muted-foreground mt-1">{step.detail}</p>
                    )}
                  </div>
                  {active && (
                    <div className="ml-auto shrink-0 size-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {isDriven
              ? "Please don't close this tab while the operation completes."
              : "Feel free to leave this open — we'll show your questions as soon as they're ready."}
          </p>
        </div>
      </div>
    </div>
  );
}
