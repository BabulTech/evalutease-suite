import type { QuizReportRow } from "@/lib/quiz-reports";

type Props = { rows: QuizReportRow[] };

export function TopPerformers({ rows }: Props) {
  if (rows.length === 0) return null;
  const medals = ["🥇", "🥈", "🥉"];
  const borders = [
    "border-warning/50 bg-warning/5",
    "border-muted-foreground/30 bg-muted/10",
    "border-orange-400/30 bg-orange-400/5",
  ];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {rows.slice(0, 3).map((row, i) => (
        <div
          key={row.id}
          className={`rounded-2xl border p-5 space-y-2 ${borders[i] ?? "border-border bg-card/50"}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-2xl">{medals[i]}</span>
            <span className="text-xs text-muted-foreground font-medium">#{row.rank} place</span>
          </div>
          <div className="font-display font-bold text-lg leading-tight">{row.name}</div>
          <div className="text-xs text-muted-foreground truncate">
            {row.email || "No email provided"}
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="font-display text-2xl font-bold text-success">{row.score}</span>
            <span className="text-xs text-muted-foreground">pts · {row.percent}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-muted/30">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${row.percent}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
