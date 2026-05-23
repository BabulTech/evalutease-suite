import React, { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";
import type { SessionPublic } from "./types";
import { ScheduledCountdown } from "./lobby/ScheduledCountdown";

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

  // react-doctor-disable-next-line react-doctor/no-cascading-set-state
  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-adjust-state-on-prop-change
    if (!session.scheduled_at) {
      setSecondsLeft(null);
      return;
    }
    const update = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(session.scheduled_at!).getTime() - Date.now()) / 1000),
      );
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

  return (
    <div className="rounded-3xl border border-border bg-card/60 backdrop-blur p-6 sm:p-10 max-w-md w-full text-center shadow-card">
      <div className="mx-auto size-16 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
        <Loader2 className="size-7 text-primary animate-spin" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-semibold">{session.title}</h1>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
        {isScheduled
          ? `You're in the lobby. The quiz will start automatically at the scheduled time${".".repeat(dots)}`
          : `You're in the lobby. Waiting for the host to start the session${".".repeat(dots)}`}
      </p>

      {isScheduled && scheduledFor && secondsLeft !== null && (
        <ScheduledCountdown secondsLeft={secondsLeft} scheduledFor={scheduledFor} />
      )}

      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Users className="size-3" />
        Quiz PIN{" "}
        <span className="font-mono font-semibold text-foreground">{session.access_code}</span>
      </div>
    </div>
  );
}
