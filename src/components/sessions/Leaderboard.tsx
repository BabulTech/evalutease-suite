import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Crown, Medal, Trophy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/PaginationControls";
import { paginate } from "@/lib/pagination";

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
  /** "live" = quiz is running, scores keep changing; "final" = quiz ended */
  mode: "live" | "final";
  emptyHint?: string;
};

export function Leaderboard({ entries, mode, emptyHint }: Props) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const sorted = useMemo(
    () =>
      entries
        .slice()
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          // Tie-break: completed players above still-playing.
          if (a.completed !== b.completed) return a.completed ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
    [entries],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((entry) =>
      [entry.name, entry.email ?? "", entry.rollNumber ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [query, sorted]);
  const tablePageSize = 25;
  const visibleRows = useMemo(
    () => paginate(filtered, page, tablePageSize),
    [filtered, page],
  );
  const chartLimit = 10;
  const topChartRows = useMemo(() => sorted.slice(0, chartLimit), [sorted]);

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
        <Trophy className="mx-auto h-10 w-10 text-muted-foreground/60" />
        <p className="mt-3 text-sm font-medium">No scores yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {emptyHint ?? "The chart will fill in as participants answer questions."}
        </p>
      </div>
    );
  }

  // Recharts data - keep names short so they fit on the y-axis.
  const data = topChartRows.map((e, i) => ({
    rank: i + 1,
    name: e.name.length > 18 ? e.name.slice(0, 16) + "…" : e.name,
    fullName: e.name,
    score: e.score,
    completed: e.completed,
  }));
  const maxScore = Math.max(...data.map((d) => d.score), 1);
  const chartHeight = Math.max(220, Math.min(560, data.length * 44));
  const completedCount = sorted.filter((entry) => entry.completed).length;
  const averageScore =
    sorted.length === 0
      ? 0
      : Math.round(sorted.reduce((sum, entry) => sum + entry.score, 0) / sorted.length);
  const highestScore = sorted[0]?.score ?? 0;
  const completionRate =
    sorted.length === 0 ? 0 : Math.round((completedCount / sorted.length) * 100);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <SummaryCard label="Total participants" value={sorted.length} />
        <SummaryCard label="Average score" value={averageScore} />
        <SummaryCard label="Highest score" value={highestScore} />
        <SummaryCard label="Completion rate" value={`${completionRate}%`} />
      </div>
      <div className="rounded-2xl border border-border bg-card/40 p-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Top {chartLimit} scores chart
        </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 28, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, Math.ceil(maxScore * 1.15)]}
            stroke="rgba(255,255,255,0.4)"
            fontSize={11}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="rgba(255,255,255,0.6)"
            fontSize={12}
            width={110}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "rgb(20 26 40)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, _key, ctx) => [
              `${value} pts${ctx.payload.completed ? "" : " (still playing)"}`,
              ctx.payload.fullName,
            ]}
            labelFormatter={() => ""}
          />
          <Bar dataKey="score" radius={[0, 8, 8, 0]} barSize={28}>
            {data.map((entry, idx) => (
              <Cell
                key={entry.name + idx}
                fill={
                  idx === 0
                    ? "oklch(0.82 0.16 180)" // top: primary teal
                    : idx === 1
                      ? "oklch(0.7 0.14 200)"
                      : idx === 2
                        ? "oklch(0.62 0.13 220)"
                        : entry.completed
                          ? "oklch(0.46 0.06 240)"
                          : "oklch(0.36 0.05 250)"
                }
              />
            ))}
            <LabelList
              dataKey="score"
              position="right"
              fill="rgba(255,255,255,0.85)"
              fontSize={12}
              fontWeight="bold"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>

      {/* Detailed table - also serves as the print-friendly view. */}
      <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
        <div className="border-b border-border/50 p-3">
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search student name or email..."
            className="h-9"
          />
        </div>
        <table className="w-full text-sm">
          <thead className="bg-secondary/40">
            <tr>
              <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                #
              </th>
              <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                Participant
              </th>
              <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                Score
              </th>
              <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((e, i) => (
              <tr key={e.id} className="border-t border-border/50">
                <td className="px-4 py-2.5 align-top">
                  <RankBadge rank={page * tablePageSize + i + 1} />
                </td>
                <td className="px-4 py-2.5 align-top">
                  <div className="font-semibold">{e.name}</div>
                  {e.email && (
                    <div className="text-[11px] text-muted-foreground truncate">{e.email}</div>
                  )}
                </td>
                <td className="px-4 py-2.5 align-top text-right">
                  <div className="text-base font-bold text-success">{e.score}</div>
                  <div className="text-[10px] text-muted-foreground">pts</div>
                </td>
                <td className="px-4 py-2.5 align-top text-right">
                  {e.completed ? (
                    <span className="inline-flex items-center rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      {mode === "final" ? "Done" : "Submitted"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-warning/15 text-warning px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      {mode === "final" ? "Did not finish" : "Playing"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationControls
          page={page}
          pageSize={tablePageSize}
          total={filtered.length}
          label="participants"
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-3">
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Crown className="h-4 w-4" />
      </span>
    );
  }
  if (rank === 2 || rank === 3) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-secondary/60 text-foreground/80">
        <Medal className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-secondary/40 text-xs font-bold text-muted-foreground">
      {rank}
    </span>
  );
}
