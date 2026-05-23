type Props = {
  label: string;
  value: number;
  tone: "success" | "danger" | "muted";
  desc?: string;
};

export function AnswerMetric({ label, value, tone, desc }: Props) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-destructive"
        : "text-muted-foreground";
  const border =
    tone === "success"
      ? "border-success/20"
      : tone === "danger"
        ? "border-destructive/20"
        : "border-border";
  const bg =
    tone === "success" ? "bg-success/5" : tone === "danger" ? "bg-destructive/5" : "bg-card/50";
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-4 space-y-1`}>
      <div className={`font-display text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-sm font-medium">{label}</div>
      {desc && <div className="text-[11px] text-muted-foreground leading-snug">{desc}</div>}
    </div>
  );
}
