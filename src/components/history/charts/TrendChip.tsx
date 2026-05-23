import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { TrendDir } from "./types";

export function TrendChip({ dir }: { dir: TrendDir }) {
  if (dir === "up")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-bold">
        <TrendingUp className="size-3" /> Improving
      </span>
    );
  if (dir === "down")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[10px] font-bold">
        <TrendingDown className="size-3" /> Declining
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 text-muted-foreground px-2 py-0.5 text-[10px] font-bold">
      <Minus className="size-3" /> Steady
    </span>
  );
}
