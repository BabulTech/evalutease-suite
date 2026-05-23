import { lazy, Suspense } from "react";
import type { SessionPublic } from "./types";
import { ScoreDisplay } from "./completion/ScoreDisplay";
import { FeedbackForm } from "./completion/FeedbackForm";

const ShareResultCard = lazy(() =>
  import("@/components/ShareResultCard").then((module) => ({ default: module.ShareResultCard })),
);

type Props = {
  session: SessionPublic;
  score: number;
  total: number;
  speedBonus: number;
  hasPendingGrading?: boolean;
  participantName?: string;
  participantEmail?: string;
};

export function Completion({
  session,
  score,
  total,
  speedBonus,
  hasPendingGrading = false,
  participantName,
  participantEmail,
}: Props) {
  const showResults = session.show_results_after_quiz !== false && !hasPendingGrading;
  const pct = total === 0 ? 0 : Math.round((score / Math.max(total, 1)) * 100);

  return (
    <div className="rounded-3xl border border-border bg-card/60 backdrop-blur p-8 max-w-md w-full text-center shadow-card space-y-6">
      <ScoreDisplay
        session={session}
        score={score}
        total={total}
        pct={pct}
        speedBonus={speedBonus}
        hasPendingGrading={hasPendingGrading}
        showResults={showResults}
      />

      {showResults && (
        <Suspense fallback={null}>
          <ShareResultCard
            mode="participant"
            quizTitle={session.title}
            score={score}
            total={total}
            pct={pct}
            speedBonus={speedBonus}
            participantName={participantName}
          />
        </Suspense>
      )}

      <FeedbackForm
        sessionId={session.id}
        participantName={participantName}
        participantEmail={participantEmail}
      />

      <p className="text-xs text-muted-foreground">
        You can close this tab. The host has your final score.
      </p>
    </div>
  );
}
