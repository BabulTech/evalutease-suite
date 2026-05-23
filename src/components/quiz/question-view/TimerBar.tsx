import { Clock } from "lucide-react";

type Props = {
  index: number;
  total: number;
  secondsLeft: number;
  pct: number;
  quizSecondsLeft?: number | null;
};

export function TimerBar({ index, total, secondsLeft, pct, quizSecondsLeft }: Props) {
  return (
    <>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Question{" "}
          <span className="font-semibold text-foreground">
            {index + 1} / {total}
          </span>
        </span>
        <div className="flex items-center gap-3">
          {quizSecondsLeft != null && (
            <span
              className={`inline-flex items-center gap-1 ${quizSecondsLeft <= 30 ? "text-destructive" : "text-muted-foreground"}`}
            >
              <Clock className="size-3" />
              <span className="font-mono font-semibold">
                Quiz: {Math.floor(quizSecondsLeft / 60)}:
                {String(quizSecondsLeft % 60).padStart(2, "0")}
              </span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3" />
            <span
              className={`font-mono font-semibold ${secondsLeft <= 5 ? "text-destructive" : "text-foreground"}`}
            >
              {secondsLeft}s
            </span>
          </span>
        </div>
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={`h-full transition-[width] duration-1000 ease-linear ${
            secondsLeft <= 5 ? "bg-destructive" : "bg-gradient-primary"
          } w-[var(--timer-pct)]`}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          style={{ "--timer-pct": `${pct}%` } as any}
        />
      </div>
    </>
  );
}
