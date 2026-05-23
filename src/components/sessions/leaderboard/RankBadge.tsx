import { Crown, Medal } from "lucide-react";

export function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Crown className="size-4" />
      </span>
    );
  }
  if (rank === 2 || rank === 3) {
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-secondary/60 text-foreground/80">
        <Medal className="size-4" />
      </span>
    );
  }
  return (
    <span className="inline-flex size-7 items-center justify-center rounded-full bg-secondary/40 text-xs font-bold text-muted-foreground">
      {rank}
    </span>
  );
}
