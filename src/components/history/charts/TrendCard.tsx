import type { ReactNode } from "react";
import type { TrendDir } from "./types";
import { TrendChip } from "./TrendChip";

type Props = {
  title: string;
  subtitle: string;
  insight?: string;
  trend?: TrendDir;
  sparse?: boolean;
  children: ReactNode;
};

export function TrendCard({ title, subtitle, insight, trend, sparse, children }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
          {insight && <p className="text-[11px] text-primary mt-1 font-medium">{insight}</p>}
        </div>
        {trend && !sparse && <TrendChip dir={trend} />}
      </div>
      {sparse ? (
        <div className="h-[160px] flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
          Not enough data yet, run more quizzes to see a trend
        </div>
      ) : (
        children
      )}
    </div>
  );
}
