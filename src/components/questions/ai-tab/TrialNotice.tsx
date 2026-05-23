import { Sparkles } from "lucide-react";

type Props = { trialRemaining: number; trialLimit: number; maxCount: number };

export function TrialNotice({ trialRemaining, trialLimit, maxCount }: Props) {
  return (
    <div
      className={`rounded-lg border px-4 py-2.5 text-xs flex items-center gap-2 ${
        trialRemaining <= 0
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-warning/30 bg-warning/5 text-warning"
      }`}
    >
      <Sparkles className="size-3.5 shrink-0" />
      {trialRemaining <= 0 ? (
        <span>
          All <strong>{trialLimit} complimentary AI calls</strong> have been used.{" "}
          <a href="/billing" className="underline font-semibold">
            Upgrade to Enterprise Pro →
          </a>
        </span>
      ) : (
        <span>
          Trial plan:{" "}
          <strong>
            {trialRemaining} of {trialLimit} AI calls remaining
          </strong>{" "}
          · max {maxCount} questions per generation.
        </span>
      )}
    </div>
  );
}
