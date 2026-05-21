import { useCallback, useEffect, useState } from "react";
import {
  Activity, Play, Pause, StopCircle, CheckCircle2, Trash2,
  Calendar, Mail, Plus, Loader2, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

// Icon + color mapping per action_type. Falls back to a neutral Activity icon.
function iconForAction(action: string) {
  switch (action) {
    case "created":        return { Icon: Plus,          tone: "text-primary" };
    case "scheduled":      return { Icon: Calendar,      tone: "text-primary" };
    case "started":        return { Icon: Play,          tone: "text-success" };
    case "paused":         return { Icon: Pause,         tone: "text-warning" };
    case "resumed":        return { Icon: Play,          tone: "text-success" };
    case "closed":         return { Icon: StopCircle,    tone: "text-warning" };
    case "completed":      return { Icon: CheckCircle2,  tone: "text-success" };
    case "finalized":      return { Icon: CheckCircle2,  tone: "text-success" };
    case "deleted":        return { Icon: Trash2,        tone: "text-destructive" };
    case "reminder_sent":  return { Icon: Mail,          tone: "text-primary" };
    default:               return { Icon: Activity,      tone: "text-muted-foreground" };
  }
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60)        return "just now";
  if (diffSec < 3600)      return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400)     return `${Math.floor(diffSec / 3600)} h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

type Props = {
  sessionId: string;
  /** Show a compact 5-row preview by default; set to false to show full list */
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  useEffect(() => { void load(); }, [load]);

  // Realtime: refresh when new activity rows arrive for this session
  useEffect(() => {
    const channel = supabase
      .channel(`session-activity:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_logs", filter: `entity_id=eq.${sessionId}` },
        () => { void load(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [sessionId, load]);

  const visibleRows = expanded ? rows : rows.slice(0, 5);

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
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
            <Loader2 className="h-4 w-4 animate-spin" /> Loading activity…
          </div>
        ) : error ? (
          <div className="px-4 py-6 flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">
            No activity recorded yet.
          </div>
        ) : (
          visibleRows.map((row) => {
            const { Icon, tone } = iconForAction(row.action_type);
            const isRisky = row.risk_score >= 40;
            return (
              <div key={row.id} className="px-4 py-3 flex items-start gap-3">
                <div className={`mt-0.5 h-7 w-7 shrink-0 rounded-lg bg-muted/40 flex items-center justify-center ${tone}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${isRisky ? "font-semibold" : ""}`}>{row.message}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {row.actor_name ?? "Unknown"} · {formatRelative(row.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
