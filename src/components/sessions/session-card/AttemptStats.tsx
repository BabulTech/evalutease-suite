function CounterPill({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  tone: "primary" | "success" | "muted";
}) {
  const color =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-success"
        : "text-muted-foreground";
  return (
    <div className="flex items-baseline gap-1">
      <span className={`font-bold ${color}`}>{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function Divider() {
  return <span className="text-muted-foreground/50">|</span>;
}

type Props = {
  joined: number;
  waiting: number;
  submitted: number;
  avgPercent: number;
};

export function AttemptStats({ joined, waiting, submitted, avgPercent }: Props) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <CounterPill value={joined} label="joined" tone="primary" />
      <Divider />
      <CounterPill value={waiting} label="waiting" tone="success" />
      <Divider />
      <CounterPill value={submitted} label="submitted" tone="success" />
      <Divider />
      <CounterPill
        value={`${avgPercent}%`}
        label="avg"
        tone={avgPercent >= 70 ? "success" : avgPercent >= 40 ? "primary" : "muted"}
      />
    </div>
  );
}
