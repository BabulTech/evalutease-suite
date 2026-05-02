import { Trophy, Sparkles } from "lucide-react";
import type { SessionPublic } from "./types";

type Props = {
  session: SessionPublic;
  score: number;
  total: number;
  speedBonus: number;
};

export function Completion({ session, score, total, speedBonus }: Props) {
  const pct = total === 0 ? 0 : Math.round((score / Math.max(total, 1)) * 100);
  return (
    <div className="rounded-3xl border border-border bg-card/60 backdrop-blur p-8 max-w-md w-full text-center shadow-card">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
        <Trophy className="h-8 w-8 text-primary-foreground" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-bold">Quiz completed</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Thanks for playing <span className="font-medium text-foreground">{session.title}</span>. The
        host will announce the final results.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card/40 p-5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Your score</div>
        <div className="mt-1 font-display text-5xl font-bold text-primary">
          {score}
          <span className="text-2xl text-muted-foreground"> / {total}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{pct}% correct</div>
        {speedBonus > 0 && (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="h-3 w-3" /> +{speedBonus} speed bonus
          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        You can close this tab. The host has your final score.
      </p>
    </div>
  );
}
