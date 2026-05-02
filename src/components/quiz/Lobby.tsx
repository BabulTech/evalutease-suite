import { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";
import type { SessionPublic } from "./types";

type Props = {
  session: SessionPublic;
};

export function Lobby({ session }: Props) {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setDots((d) => (d % 3) + 1), 500);
    return () => clearInterval(t);
  }, []);

  const scheduledFor = session.scheduled_at ? new Date(session.scheduled_at) : null;

  return (
    <div className="rounded-3xl border border-border bg-card/60 backdrop-blur p-6 sm:p-10 max-w-md w-full text-center shadow-card">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
        <Loader2 className="h-7 w-7 text-primary animate-spin" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-bold">{session.title}</h1>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
        You're in the lobby. Waiting for other participants to join and for the host to start the
        session{".".repeat(dots)}
      </p>
      {scheduledFor && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
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
