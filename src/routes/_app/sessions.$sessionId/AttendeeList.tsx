import { Users } from "lucide-react";
import { PaginationControls } from "@/components/PaginationControls";
import { paginate } from "@/lib/pagination";
import type { Attendee } from "./types";
import { PARTICIPANT_PAGE_SIZES } from "./types";

export function AttendeeList({
  list,
  showScores,
  page,
  total,
  onPageChange,
  pageSize,
  onPageSizeChange,
  emptyHint,
}: {
  list: Attendee[];
  showScores?: boolean;
  page?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  emptyHint: string;
}) {
  const resolvedPage = page ?? 0;
  const resolvedTotal = total ?? list.length;
  const resolvedPageSize = pageSize ?? 25;
  const visible = page === undefined ? paginate(list, resolvedPage, resolvedPageSize) : list;

  if (list.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/20 p-8 text-center text-xs text-muted-foreground">
        {emptyHint}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card/20">
      <ul className="space-y-1.5 p-2">
        {visible.map((a, i) => (
          <li key={a.id} className="flex items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2.5">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {resolvedPage * resolvedPageSize + i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{a.name}</div>
              {a.email && (
                <div className="text-[11px] text-muted-foreground truncate">{a.email}</div>
              )}
            </div>
            {showScores ? (
              <div className="text-right">
                <div className="text-sm font-bold text-success">
                  {a.score} / {a.total}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  pts
                </div>
              </div>
            ) : (
              <span className="rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                Waiting
              </span>
            )}
            {!showScores && <Users className="size-3 text-muted-foreground" />}
          </li>
        ))}
      </ul>
      <PaginationControls
        page={resolvedPage}
        pageSize={resolvedPageSize}
        total={resolvedTotal}
        label="participants"
        onPageChange={onPageChange ?? (() => {})}
        pageSizeOptions={pageSize ? PARTICIPANT_PAGE_SIZES : undefined}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
