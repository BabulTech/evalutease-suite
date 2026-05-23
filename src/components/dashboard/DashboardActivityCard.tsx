import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RecentActivityRow } from "./activity/types";
import { ActivityCardHeader } from "./activity/ActivityCardHeader";
import { ModuleFilterBar } from "./activity/ModuleFilterBar";
import { ActivityRow } from "./activity/ActivityRow";
import { ActivityFeedState } from "./activity/ActivityFeedState";

export type { RecentActivityRow };

type Props = {
  /** How many rows to display at most. Default 20. */
  limit?: number;
};

export function DashboardActivityCard({ limit = 20 }: Props) {
  const [rows, setRows] = useState<RecentActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState<string>("all");

  // Fetch a larger pool so client-side filtering has enough rows after a module filter.
  const FETCH_POOL = Math.max(100, limit * 5);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: err } = await (supabase as any).rpc("get_my_recent_activity", {
      p_limit: FETCH_POOL,
    });
    if (err) {
      setError(err.message);
      setRows([]);
    } else {
      setRows((data ?? []) as RecentActivityRow[]);
    }
    setLoading(false);
  }, [FETCH_POOL]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id ?? null;
      if (!userId) return;
      channel = supabase
        .channel(`my-activity:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "activity_logs",
            filter: `plan_owner_id=eq.${userId}`,
          },
          () => {
            void load();
          },
        )
        .subscribe();
    })();
    return () => {
      if (channel) {
        void channel.unsubscribe();
        void supabase.removeChannel(channel);
      }
    };
  }, [load]);

  const filteredRows = (
    moduleFilter === "all" ? rows : rows.filter((r) => r.module === moduleFilter)
  ).slice(0, limit);
  const showFeedState = loading || !!error || filteredRows.length === 0;

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      <ActivityCardHeader
        filteredCount={filteredRows.length}
        totalCount={rows.length}
        moduleFilter={moduleFilter}
        loading={loading}
      />
      <ModuleFilterBar rows={rows} activeFilter={moduleFilter} onFilterChange={setModuleFilter} />
      <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
        {showFeedState ? (
          <ActivityFeedState loading={loading} error={error} moduleFilter={moduleFilter} />
        ) : (
          filteredRows.map((row) => <ActivityRow key={row.id} row={row} />)
        )}
      </div>
    </div>
  );
}
