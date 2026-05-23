import { formatCountdown } from "./utils";

type Props = {
  secondsLeft: number;
  scheduledFor: Date;
};

export function ScheduledCountdown({ secondsLeft, scheduledFor }: Props) {
  return (
    <>
      {secondsLeft > 0 && (
        <div className="mt-5 flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Starting in
          </span>
          <span className="font-mono text-3xl font-bold text-primary tabular-nums">
            {formatCountdown(secondsLeft)}
          </span>
        </div>
      )}

      {secondsLeft === 0 && (
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-success/15 px-3 py-1.5 text-xs font-medium text-success">
          Starting now…
        </div>
      )}

      {secondsLeft > 0 && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
          Scheduled for {scheduledFor.toLocaleString()}
        </p>
      )}
    </>
  );
}
