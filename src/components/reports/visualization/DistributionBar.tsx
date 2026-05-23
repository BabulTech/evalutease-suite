type Props = {
  buckets: { top: number; pass: number; fail: number; left: number };
  passMark: number;
};

export function DistributionBar({ buckets, passMark }: Props) {
  const total = buckets.top + buckets.pass + buckets.fail + buckets.left;
  if (total === 0) return null;
  const pct = (n: number) => (n / total) * 100;
  const topThreshold = Math.min(100, passMark + 25);
  const bands = [
    {
      dot: "bg-success",
      label: `Excellent (>= ${topThreshold}%)`,
      desc: "Scored in the top band",
      value: buckets.top,
    },
    {
      dot: "bg-primary/80",
      label: `Passed (${passMark}-${topThreshold - 1}%)`,
      desc: "Met the pass mark",
      value: buckets.pass,
    },
    {
      dot: "bg-destructive/80",
      label: `Below pass (< ${passMark}%)`,
      desc: "Did not meet the pass mark",
      value: buckets.fail,
    },
    {
      dot: "bg-muted-foreground/40",
      label: "Did not finish",
      desc: "Left without submitting",
      value: buckets.left,
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
      <div className="h-4 w-full overflow-hidden rounded-full bg-muted/30 flex gap-0.5">
        {bands.map(
          (band) =>
            pct(band.value) > 0 && (
              <div
                key={band.label}
                className={`h-full ${band.dot} first:rounded-l-full last:rounded-r-full transition-all`}
                style={{ width: `${pct(band.value)}%` }}
                title={`${band.label}: ${band.value}`}
              />
            ),
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {bands.map((band) => (
          <div key={band.label} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className={`inline-block size-2.5 rounded-full shrink-0 ${band.dot}`} />
              <span className="text-xs font-semibold">{band.value}</span>
              <span className="text-xs text-muted-foreground">
                ({Math.round(pct(band.value))}%)
              </span>
            </div>
            <div className="text-[11px] font-medium pl-4 leading-tight">{band.label}</div>
            <div className="text-[10px] text-muted-foreground pl-4">{band.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
