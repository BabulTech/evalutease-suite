import { useCallback, useEffect, useState } from "react";
import { Activity, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ActivityRow } from "./session-activity/ActivityRow";

export type SessionActivityRow = {
  id: string;
  actor_name: string | null;
  actor_email: string | null;
  action_type: string;
  message: string;
  details: Record<string, unknown> | null;
  risk_score: number;
  created_at: string;
};

type Props = {
  sessionId: string;
  preview?: boolean;
};

export function SessionActivityPanel({ sessionId, preview = true }: Props) {
  const [rows, setRows] = useState<SessionActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!preview);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not yet in generated Supabase types
    const { data, error: err } = await (supabase as any).rpc("get_session_activity", {
      p_session_id: sessionId,
      p_limit: expanded ? 200 : 8,
    });
    if (err) {
      setError(err.message);
      setRows([]);
    } else {
      setRows((data ?? []) as SessionActivityRow[]);
    }
    setLoading(false);
  }, [sessionId, expanded]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`session-activity:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_logs",
          filter: `entity_id=eq.${sessionId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void channel.unsubscribe();
      void supabase.removeChannel(channel);
    };
    // react-doctor-disable-next-line react-doctor/prefer-use-effect-event
  }, [sessionId, load]);

  const visibleRows = expanded ? rows : rows.slice(0, 5);

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <h3 className="font-semibold text-sm">Recent activity</h3>
          {!loading && rows.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5">
              {rows.length}
            </span>
          )}
        </div>
        {rows.length > 5 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-primary hover:underline"
          >
            {expanded ? "Show less" : `Show all (${rows.length})`}
          </button>
        )}
      </div>

      <div className="divide-y divide-border">
        {loading ? (
          <div className="px-4 py-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading activity…
          </div>
        ) : error ? (
          <div className="px-4 py-6 flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="size-4" /> {error}
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">
            No activity recorded yet.
          </div>
        ) : (
          visibleRows.map((row) => <ActivityRow key={row.id} row={row} />)
        )}
      </div>
    </div>
  );
}
