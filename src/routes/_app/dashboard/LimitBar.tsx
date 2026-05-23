// eslint-disable-next-line sonarjs/cognitive-complexity -- complex plan-limit display logic, intentional
export function LimitBar({ used, limit }: { used: number; limit: number }) {
  if (limit === -1) return <span className="text-[10px] text-muted-foreground">Unlimited</span>;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const left = Math.max(0, limit - used);
  const danger = pct >= 80;
  return (
    <div className="space-y-1 mt-2">
      <div
        className={`text-[10px] font-medium ${danger ? "text-destructive" : "text-muted-foreground"}`}
      >
        {left} left of {limit}
      </div>
      <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${danger ? "bg-destructive" : "bg-primary/60"} ${
            pct <= 10
              ? "w-[10%]"
              : pct <= 20
                ? "w-1/5"
                : pct <= 25
                  ? "w-1/4"
                  : pct <= 33
                    ? "w-1/3"
                    : pct <= 40
                      ? "w-2/5"
                      : pct <= 50
                        ? "w-1/2"
                        : pct <= 60
                          ? "w-3/5"
                          : pct <= 66
                            ? "w-2/3"
                            : pct <= 75
                              ? "w-3/4"
                              : pct <= 80
                                ? "w-4/5"
                                : pct <= 90
                                  ? "w-[90%]"
                                  : "w-full"
          }`}
        />
      </div>
    </div>
  );
}
