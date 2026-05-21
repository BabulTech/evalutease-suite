import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity, Play, Pause, StopCircle, CheckCircle2, Trash2, Calendar, Mail,
  Plus, UserPlus, FileText, MessageSquare, CreditCard, Coins, AlertTriangle, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type RecentActivityRow = {
  id: string;
  actor_name: string | null;
  action_type: string;
  module: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  message: string;
  details: Record<string, unknown> | null;
  risk_score: number;
  created_at: string;
};

// Map (module, action_type) → icon + colour. Falls back to a neutral Activity icon.
function iconFor(row: RecentActivityRow) {
  const a = row.action_type;
  switch (row.module) {
    case "sessions":
      if (a === "created")       return { Icon: Plus,         tone: "text-primary" };
      if (a === "scheduled")     return { Icon: Calendar,     tone: "text-primary" };
      if (a === "started")       return { Icon: Play,         tone: "text-success" };
      if (a === "paused")        return { Icon: Pause,        tone: "text-warning" };
      if (a === "resumed")       return { Icon: Play,         tone: "text-success" };
      if (a === "closed")        return { Icon: StopCircle,   tone: "text-warning" };
      if (a === "completed")     return { Icon: CheckCircle2, tone: "text-success" };
      if (a === "finalized")     return { Icon: CheckCircle2, tone: "text-success" };
      if (a === "deleted")       return { Icon: Trash2,       tone: "text-destructive" };
      if (a === "reminder_sent") return { Icon: Mail,         tone: "text-primary" };
      if (a === "joined")        return { Icon: UserPlus,     tone: "text-muted-foreground" };
      if (a === "submitted")     return { Icon: FileText,     tone: "text-success" };
      break;
    case "grading":              return { Icon: CheckCircle2, tone: "text-success" };
    case "feedback":             return { Icon: MessageSquare, tone: "text-primary" };
    case "billing":
      if (a === "credit_added")  return { Icon: Coins,        tone: "text-success" };
      if (a === "credit_spent")  return { Icon: Coins,        tone: "text-warning" };
      if (a === "rejected")      return { Icon: AlertTriangle, tone: "text-destructive" };
      return { Icon: CreditCard, tone: "text-primary" };
  }
  return { Icon: Activity, tone: "text-muted-foreground" };
}

// Internal link target for an activity row, when one makes sense.
function linkFor(row: RecentActivityRow): string | null {
  if (row.module === "sessions" && row.entity_type === "quiz_session" && row.entity_id) {
    return `/sessions/${row.entity_id}`;
  }
  if (row.module === "sessions" && (row.entity_type === "quiz_attempt" || row.entity_type === "quiz_answer")) {
    const sid = (row.details as { session_id?: string } | null)?.session_id;
    if (sid) return `/sessions/${sid}`;
  }
  if (row.module === "billing") return "/billing";
  if (row.module === "feedback") return "/settings";
  return null;
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60)        return "just now";
  if (diffSec < 3600)      return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400)     return `${Math.floor(diffSec / 3600)} h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

type Props = {
  /** How many rows to display at most. Default 20. */
  limit?: number;
};

// Module options shown in the filter chip row. "all" = no filter.
const MODULE_FILTERS: { value: string; label: string }[] = [
  { value: "all",          label: "All" },
  { value: "sessions",     label: "Sessions" },
  { value: "grading",      label: "Grading" },
  { value: "participants", label: "Participants" },
  { value: "questions",    label: "Questions" },
  { value: "billing",      label: "Billing" },
  { value: "auth",         label: "Account" },
  { value: "admin",        label: "Admin" },
];

export function DashboardActivityCard({ limit = 20 }: Props) {
  const [rows, setRows] = useState<RecentActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState<string>("all");

  // Fetch a larger pool so client-side filtering still has rows to show
  // after a module filter is applied. Show only `limit` after filtering.
  const FETCH_POOL = Math.max(100, limit * 5);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: err } = await (supabase as any).rpc("get_my_recent_activity", { p_limit: FETCH_POOL });
    if (err) {
      setError(err.message);
      setRows([]);
    } else {
      setRows((data ?? []) as RecentActivityRow[]);
    }
    setLoading(false);
  }, [FETCH_POOL]);

  useEffect(() => { void load(); }, [load]);

  // Realtime: new activity rows for me arrive live
  useEffect(() => {
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id ?? null;
      if (!userId) return;
      channel = supabase
        .channel(`my-activity:${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "activity_logs", filter: `plan_owner_id=eq.${userId}` },
          () => { void load(); },
        )
        .subscribe();
    })();
    return () => { if (channel) void supabase.removeChannel(channel); };
  }, [load]);

  // Apply module filter then trim to display limit
  const filteredRows = (moduleFilter === "all"
    ? rows
    : rows.filter((r) => r.module === moduleFilter)
  ).slice(0, limit);

  // Counts per module — used to show a tiny badge on each chip
  const moduleCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.module] = (acc[r.module] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Recent activity</h3>
          {!loading && filteredRows.length > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5">
              {filteredRows.length}{moduleFilter !== "all" ? ` / ${rows.length}` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Module filter chips — wrap on mobile so nothing hides behind the edge */}
      <div className="px-3 py-2 border-b border-border bg-card/30 flex flex-wrap gap-1.5">
        {MODULE_FILTERS.map((m) => {
          const count = m.value === "all" ? rows.length : (moduleCounts[m.value] ?? 0);
          const active = moduleFilter === m.value;
          const disabled = m.value !== "all" && count === 0;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => setModuleFilter(m.value)}
              disabled={disabled}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all ${
                active
                  ? "bg-primary text-primary-foreground"
                  : disabled
                    ? "text-muted-foreground/40 cursor-not-allowed"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {m.label}
              {count > 0 && (
                <span className={`text-[10px] rounded-full px-1.5 ${
                  active ? "bg-primary-foreground/20" : "bg-background/60"
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
        {loading ? (
          <div className="px-4 py-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading activity…
          </div>
        ) : error ? (
          <div className="px-4 py-6 flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">
            {moduleFilter === "all"
              ? "No activity yet. Start a quiz, add participants, or run AI grading to see entries here."
              : `No "${MODULE_FILTERS.find((m) => m.value === moduleFilter)?.label}" activity in the recent feed.`}
          </div>
        ) : (
          filteredRows.map((row) => {
            const { Icon, tone } = iconFor(row);
            const isRisky = row.risk_score >= 40;
            const href = linkFor(row);
            const content = (
              <div className="px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                <div className={`mt-0.5 h-7 w-7 shrink-0 rounded-lg bg-muted/40 flex items-center justify-center ${tone}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${isRisky ? "font-semibold" : ""}`}>{row.message}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    <span className="uppercase tracking-wider">{row.module}</span> · {formatRelative(row.created_at)}
                  </p>
                </div>
              </div>
            );
            return href ? (
              <Link key={row.id} to={href} className="block">
                {content}
              </Link>
            ) : (
              <div key={row.id}>{content}</div>
            );
          })
        )}
      </div>
    </div>
  );
}
