import React, { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";
import type { SessionPublic } from "./types";

type Props = {
  session: SessionPublic;
  onScheduledTimeReached?: () => void;
};

export function Lobby({ session, onScheduledTimeReached }: Props) {
  const [dots, setDots] = useState(1);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const firedRef = React.useRef(false);

  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d % 3) + 1), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!session.scheduled_at) { setSecondsLeft(null); return; }
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(session.scheduled_at!).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff === 0 && !firedRef.current) {
        firedRef.current = true;
        onScheduledTimeReached?.();
      }
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [session.scheduled_at, onScheduledTimeReached]);

  const scheduledFor = session.scheduled_at ? new Date(session.scheduled_at) : null;
  const isScheduled = !!scheduledFor;

  const formatCountdown = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="rounded-3xl border border-border bg-card/60 backdrop-blur p-6 sm:p-10 max-w-md w-full text-center shadow-card">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
        <Loader2 className="h-7 w-7 text-primary animate-spin" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-bold">{session.title}</h1>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
        {isScheduled
          ? `You're in the lobby. The quiz will start automatically at the scheduled time${".".repeat(dots)}`
          : `You're in the lobby. Waiting for the host to start the session${".".repeat(dots)}`}
      </p>

      {isScheduled && secondsLeft !== null && secondsLeft > 0 && (
        <div className="mt-5 flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Starting in</span>
          <span className="font-mono text-3xl font-bold text-primary tabular-nums">
            {formatCountdown(secondsLeft)}
          </span>
        </div>
      )}

      {isScheduled && secondsLeft === 0 && (
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-success/15 px-3 py-1.5 text-xs font-medium text-success">
          Starting now…
        </div>
      )}

      {isScheduled && scheduledFor && secondsLeft !== null && secondsLeft > 0 && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
          Scheduled for {scheduledFor.toLocaleString()}
        </p>
      )}

      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3 w-3" />
        Quiz PIN{" "}
        <span className="font-mono font-semibold text-foreground">{session.access_code}</span>
      </div>
    </div>
  );
}
