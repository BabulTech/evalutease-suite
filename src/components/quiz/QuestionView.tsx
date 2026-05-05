import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Check, PauseCircle } from "lucide-react";
import type { QuizQuestion } from "./types";

type Props = {
  question: QuizQuestion;
  total: number;
  index: number;
  secondsLeft: number;
  totalSeconds: number;
  onLockAnswer: (answer: string) => Promise<void> | void;
  isAnswered: boolean;
  paused?: boolean;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function QuestionView({
  question,
  total,
  index,
  secondsLeft,
  totalSeconds,
  onLockAnswer,
  isAnswered,
  paused = false,
}: Props) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lastQuestionId = useRef<string | null>(null);

  useEffect(() => {
    if (lastQuestionId.current !== question.id) {
      setChosen(null);
      setSubmitting(false);
      lastQuestionId.current = question.id;
    }
  }, [question.id]);

  const pct = useMemo(() => {
    if (!totalSeconds) return 0;
    return Math.max(0, Math.min(100, Math.round((secondsLeft / totalSeconds) * 100)));
  }, [secondsLeft, totalSeconds]);

  const lock = async (option: string) => {
    if (isAnswered || submitting || paused) return;
    setChosen(option);
    setSubmitting(true);
    try {
      await onLockAnswer(option);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative rounded-3xl border border-border bg-card/60 backdrop-blur p-6 sm:p-8 max-w-2xl w-full shadow-card">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Question{" "}
          <span className="font-semibold text-foreground">
            {index + 1} / {total}
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          <span
            className={`font-mono font-semibold ${secondsLeft <= 5 ? "text-destructive" : "text-foreground"}`}
          >
            {secondsLeft}s
          </span>
        </span>
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={`h-full transition-[width] duration-1000 ease-linear ${
            secondsLeft <= 5 ? "bg-destructive" : "bg-gradient-primary"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <h2 className="mt-6 font-display text-xl sm:text-2xl font-bold leading-snug">
        {question.text}
      </h2>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {question.options.map((option, i) => {
          const isChosen = chosen === option;
          const disabled = isAnswered || submitting || paused;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => lock(option)}
              className={`text-left rounded-2xl border-2 px-4 py-3 transition-all ${
                isChosen
                  ? "border-primary bg-primary/15 shadow-glow"
                  : isAnswered
                    ? "border-border bg-card/30 opacity-60"
                    : "border-border bg-card/40 hover:border-primary/50"
              } ${!disabled ? "cursor-pointer" : "cursor-default"}`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    isChosen
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isChosen ? <Check className="h-4 w-4" /> : (LETTERS[i] ?? i + 1)}
                </span>
                <span className="text-sm sm:text-base font-medium">{option}</span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-xs text-muted-foreground text-center">
        {isAnswered
          ? "Locked in. Waiting for the next question…"
          : chosen
            ? "Submitting…"
            : "Tap an option to lock your answer. The next question loads automatically."}
      </p>

      {paused && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-3xl bg-background/85 backdrop-blur-sm text-center px-6"
          aria-live="polite"
        >
          <div className="h-14 w-14 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center">
            <PauseCircle className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-display text-xl font-bold">Quiz paused</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            The teacher has paused this quiz. Hang tight — your timer is frozen and answers are
            disabled until it resumes.
          </p>
        </div>
      )}
    </div>
  );
}
