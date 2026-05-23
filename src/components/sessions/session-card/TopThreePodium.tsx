import { Crown } from "lucide-react";

type TopEntry = { name: string; score: number; total: number };

type Props = { topThree: (TopEntry | undefined)[] };

export function TopThreePodium({ topThree }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[0, 1, 2].map((i) => {
        const t = topThree[i];
        return (
          <div key={i} className="rounded-xl border border-border bg-card/40 p-3 min-h-[88px]">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Crown className="size-3 text-warning" /> Top {i + 1}
            </div>
            {t ? (
              <>
                <div className="mt-2 text-sm font-semibold truncate">{t.name}</div>
                <div className="text-xs text-success font-bold">
                  {t.score}/{t.total}
                </div>
              </>
            ) : (
              <>
                <div className="mt-2 text-sm font-semibold text-muted-foreground">Waiting…</div>
                <div className="text-xs text-muted-foreground">No result yet</div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
