type Props = {
  active?: boolean;
  payload?: { value: number; color: string; name: string }[];
  label?: string;
  unit?: string;
  labelFmt?: (l: string) => string;
};

export function ChartTooltip({ active, payload, label, unit = "", labelFmt }: Props) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-1 font-medium">
        {labelFmt && label ? labelFmt(label) : label}
      </p>
      {payload.map((p) => (
        <p key={p.name} className="font-bold text-foreground">
          {p.value}
          {unit}
        </p>
      ))}
    </div>
  );
}
