import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/PaginationControls";
import { RankBadge } from "./RankBadge";
import type { LeaderboardEntry } from "../Leaderboard";

type Props = {
  rows: LeaderboardEntry[];
  page: number;
  pageSize: number;
  total: number;
  query: string;
  mode: "live" | "final";
  onQueryChange: (q: string) => void;
  onPageChange: (p: number) => void;
  pageOffset: number;
};

export function ParticipantTable({
  rows,
  page,
  pageSize,
  total,
  query,
  mode,
  onQueryChange,
  onPageChange,
  pageOffset,
}: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
      <div className="border-b border-border/50 p-3">
        <Input
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            onPageChange(0);
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
          {rows.map((e, i) => (
            <tr key={e.id} className="border-t border-border/50">
              <td className="px-4 py-2.5 align-top">
                <RankBadge rank={pageOffset + i + 1} />
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
        pageSize={pageSize}
        total={total}
        label="participants"
        onPageChange={onPageChange}
      />
    </div>
  );
}
