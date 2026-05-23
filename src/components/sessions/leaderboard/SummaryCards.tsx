function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-3">
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

type Props = {
  total: number;
  averageScore: number;
  highestScore: number;
  completionRate: number;
};

export function SummaryCards({ total, averageScore, highestScore, completionRate }: Props) {
  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
      <SummaryCard label="Total participants" value={total} />
      <SummaryCard label="Average score" value={averageScore} />
      <SummaryCard label="Highest score" value={highestScore} />
      <SummaryCard label="Completion rate" value={`${completionRate}%`} />
    </div>
  );
}
