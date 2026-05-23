import { Trophy, Sparkles, Clock } from "lucide-react";
import type { SessionPublic } from "../types";

type Props = {
  session: SessionPublic;
  score: number;
  total: number;
  pct: number;
  speedBonus: number;
  hasPendingGrading: boolean;
  showResults: boolean;
};

export function ScoreDisplay({
  session,
  score,
  total,
  pct,
  speedBonus,
  hasPendingGrading,
  showResults,
}: Props) {
  return (
    <div>
      <div className="mx-auto size-16 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow">
        <Trophy className="size-8 text-primary-foreground" />
      </div>
      <h1 className="mt-5 font-display text-2xl font-semibold">Quiz completed</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Thanks for playing <span className="font-medium text-foreground">{session.title}</span>. The
        host will announce the final results.
      </p>

      {showResults ? (
        <div className="mt-5 rounded-2xl border border-border bg-card/40 p-5 space-y-3">
          {hasPendingGrading ? (
            <>
              <div className="flex items-center justify-center gap-2 text-warning">
                <Clock className="size-5" />
                <span className="font-semibold text-sm">Score pending grading</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Your written answers will be reviewed by the teacher. Your final score will be
                updated once grading is complete.
              </p>
              {score > 0 && (
                <div className="pt-1 border-t border-border/50">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Auto-graded so far
                  </div>
                  <div className="mt-0.5 font-display text-3xl font-bold text-primary">
                    {score}
                    <span className="text-lg text-muted-foreground"> / {total}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Your score
              </div>
              <div className="font-display text-5xl font-bold text-primary">
                {score}
                <span className="text-2xl text-muted-foreground"> / {total}</span>
              </div>
              <div className="text-xs text-muted-foreground">{pct}% correct</div>
              {speedBonus > 0 && (
                <div className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  <Sparkles className="size-3" /> +{speedBonus} speed bonus
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-border bg-card/40 p-5">
          <div className="text-sm text-muted-foreground">
            The host will announce the results. Thank you for participating!
          </div>
        </div>
      )}
    </div>
  );
}
