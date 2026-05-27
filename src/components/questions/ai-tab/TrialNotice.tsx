import { Sparkles } from "lucide-react";

type Props = { freeAiRemaining: number; freeAiLimit: number; maxCount: number };

export function TrialNotice({ freeAiRemaining, freeAiLimit, maxCount }: Props) {
  return (
    <div
      className={`rounded-lg border px-4 py-2.5 text-xs flex items-center gap-2 ${
        freeAiRemaining <= 0
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-warning/30 bg-warning/5 text-warning"
      }`}
    >
      <Sparkles className="size-3.5 shrink-0" />
      {freeAiRemaining <= 0 ? (
        <span>
          All <strong>{freeAiLimit} complimentary AI calls</strong> have been used.{" "}
          <a href="/billing" className="underline font-semibold">
            Upgrade to Enterprise Pro →
          </a>
        </span>
      ) : (
        <span>
          Free plan:{" "}
          <strong>
            {freeAiRemaining} of {freeAiLimit} AI calls remaining
          </strong>{" "}
          · max {maxCount} questions per generation.
        </span>
      )}
    </div>
  );
}
