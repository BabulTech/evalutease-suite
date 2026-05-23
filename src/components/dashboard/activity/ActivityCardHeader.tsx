import { Activity } from "lucide-react";

type Props = {
  filteredCount: number;
  totalCount: number;
  moduleFilter: string;
  loading: boolean;
};

export function ActivityCardHeader({ filteredCount, totalCount, moduleFilter, loading }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-primary" />
        <h3 className="font-semibold text-sm">Recent activity</h3>
        {!loading && filteredCount > 0 && (
          <span className="text-[10px] text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5">
            {filteredCount}
            {moduleFilter !== "all" ? ` / ${totalCount}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}
