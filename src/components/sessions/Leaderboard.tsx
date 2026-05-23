import { lazy, Suspense, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { paginate } from "@/lib/pagination";
import { SummaryCards } from "./leaderboard/SummaryCards";
const ScoreChart = lazy(() => import("./leaderboard/ScoreChart").then((m) => ({ default: m.ScoreChart })));
import { ParticipantTable } from "./leaderboard/ParticipantTable";

export type LeaderboardEntry = {
  id: string;
  name: string;
  email: string | null;
  rollNumber?: string | null;
  score: number;
  total: number;
  completed: boolean;
};

type Props = {
  entries: LeaderboardEntry[];
  mode: "live" | "final";
  emptyHint?: string;
};

export function Leaderboard({ entries, mode, emptyHint }: Props) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const tablePageSize = 25;
  const chartLimit = 10;

  const sorted = useMemo(
    () =>
      entries.slice().sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.completed !== b.completed) return a.completed ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [entries],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((e) =>
      [e.name, e.email ?? "", e.rollNumber ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [query, sorted]);

  const visibleRows = useMemo(() => paginate(filtered, page, tablePageSize), [filtered, page]);

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
        <Trophy className="mx-auto size-10 text-muted-foreground/60" />
        <p className="mt-3 text-sm font-medium">No scores yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {emptyHint ?? "The chart will fill in as participants answer questions."}
        </p>
      </div>
    );
  }

  const topChartRows = sorted.slice(0, chartLimit);
  const chartData = topChartRows.map((e, i) => ({
    rank: i + 1,
    name: e.name.length > 18 ? e.name.slice(0, 16) + "…" : e.name,
    fullName: e.name,
    score: e.score,
    completed: e.completed,
  }));
  const maxScore = Math.max(...chartData.map((d) => d.score), 1);

  const completedCount = sorted.filter((e) => e.completed).length;
  const averageScore = Math.round(sorted.reduce((s, e) => s + e.score, 0) / sorted.length);
  const completionRate = Math.round((completedCount / sorted.length) * 100);

  return (
    <div className="space-y-4">
      <SummaryCards
        total={sorted.length}
        averageScore={averageScore}
        highestScore={sorted[0]?.score ?? 0}
        completionRate={completionRate}
      />
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted/30" />}>
        <ScoreChart data={chartData} maxScore={maxScore} />
      </Suspense>
      <ParticipantTable
        rows={visibleRows}
        page={page}
        pageSize={tablePageSize}
        total={filtered.length}
        query={query}
        mode={mode}
        onQueryChange={setQuery}
        onPageChange={setPage}
        pageOffset={page * tablePageSize}
      />
    </div>
  );
}
