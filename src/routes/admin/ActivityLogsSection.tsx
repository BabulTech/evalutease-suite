import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { RefreshCw, Search, Activity, AlertTriangle, Layers, Users, Eye, Trash2, X, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { StatCard, TableShell, SkeletonRows, SectionHead } from "./-shared";
import { statusBadge } from "./helpers";

type ActivityLogRow = {
  id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action_type: string;
  module: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  message: string;
  details: Record<string, unknown>;
  risk_score: number;
  created_at: string;
};

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function ActivityLogsSection() {
  const [rows, setRows] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<ActivityLogRow | null>(null);
  const [selected2, setSelected2] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 250);

  const load = useCallback(async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("get_admin_activity_logs", {
      p_limit:       500,
      p_module:      moduleFilter !== "all" ? moduleFilter : null,
      p_action_type: actionFilter !== "all" ? actionFilter : null,
      p_search:      debouncedSearch.trim() || null,
      p_date_from:   dateFrom ? new Date(dateFrom).toISOString() : null,
      p_date_to:     dateTo   ? new Date(dateTo + "T23:59:59").toISOString() : null,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as ActivityLogRow[]);
  }, [debouncedSearch, moduleFilter, actionFilter, dateFrom, dateTo]);

  useEffect(() => { void load(); }, [load]);

  const modules = useMemo(() => Array.from(new Set(rows.map((r) => r.module))).sort(), [rows]);
  const actions = useMemo(() => Array.from(new Set(rows.map((r) => r.action_type))).sort(), [rows]);
  const users = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach((r) => { if (r.actor_user_id) seen.set(r.actor_user_id, r.actor_name ?? r.actor_email ?? r.actor_user_id); });
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    if (userFilter === "all") return rows;
    return rows.filter((r) => r.actor_user_id === userFilter);
  }, [rows, userFilter]);

  const highRisk = filtered.filter((r) => r.risk_score >= 50).length;

  const toggleSelect = (id: string) =>
    setSelected2((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () =>
    setSelected2((prev) => prev.size === filtered.length ? new Set() : new Set(filtered.map((r) => r.id)));
  const allSelected = filtered.length > 0 && selected2.size === filtered.length;

  const deleteLog = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("admin_delete_activity_log", { p_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Log deleted");
    setConfirmDeleteId(null);
    void load();
  };

  const bulkDelete = async () => {
    const ids = [...selected2];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("admin_delete_activity_logs", { p_ids: ids });
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} logs deleted`);
    setSelected2(new Set());
    setConfirmBulk(false);
    void load();
  };

  const clearFilters = () => {
    setSearch(""); setModuleFilter("all"); setActionFilter("all");
    setUserFilter("all"); setDateFrom(""); setDateTo("");
  };
  const hasFilters = search || moduleFilter !== "all" || actionFilter !== "all" || userFilter !== "all" || dateFrom || dateTo;

  return (
    <div className="space-y-5">
      {confirmBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <p className="text-sm font-medium">Delete {selected2.size} selected logs? This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirmBulk(false)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/40">Cancel</button>
              <button type="button" onClick={() => void bulkDelete()} className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90">Delete All</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <p className="text-sm font-medium">Delete this log entry? This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/40">Cancel</button>
              <button type="button" onClick={() => void deleteLog(confirmDeleteId)} className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHead title="Activity Logs" aria-label="Activity Logs" sub="Who did what, when, and on which record." />
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-2">
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Loaded events" value={filtered.length} icon={Activity} />
        <StatCard label="High risk" value={highRisk} icon={AlertTriangle} color="text-destructive" />
        <StatCard label="Modules" value={modules.length} icon={Layers} color="text-primary" />
        <StatCard
          label="Users active"
          value={new Set(filtered.flatMap((r) => (r.actor_user_id ? [r.actor_user_id] : []))).size}
          icon={Users}
          color="text-success"
        />
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="grid gap-2 md:grid-cols-[1fr_160px_160px_160px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search user, email, action, entity..."
              className="pl-9"
            />
          </div>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger><Filter className="size-3.5 mr-1" /><SelectValue placeholder="Module" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              {modules.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger><Filter className="size-3.5 mr-1" /><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger><Filter className="size-3.5 mr-1" /><SelectValue placeholder="All users" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label htmlFor="activity-from-date" className="text-xs text-muted-foreground whitespace-nowrap">From</label>
            <input
              id="activity-from-date"
              type="date"
              title="From date" aria-label="From date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label htmlFor="activity-to-date" className="text-xs text-muted-foreground whitespace-nowrap">To</label>
            <input
              id="activity-to-date"
              type="date"
              title="To date" aria-label="To date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted/40">
              <X className="size-3" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {selected2.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30">
          <span className="text-sm font-medium text-destructive">{selected2.size} selected</span>
          <button type="button" onClick={() => setConfirmBulk(true)} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90">
            <Trash2 className="size-3.5" /> Delete Selected
          </button>
          <button type="button" title="Clear selection" aria-label="Clear selection" onClick={() => setSelected2(new Set())} className="p-1 rounded-lg text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
      )}

      <TableShell footer={`${filtered.length} activity events`}>
        <thead>
          <tr className="border-b border-border/60 bg-muted/20">
            <th className="px-3 py-2.5 text-left">
              <input type="checkbox" title="Select all" aria-label="Select all" checked={allSelected} onChange={toggleAll} className="rounded" />
            </th>
            {["When", "User", "Action", "Module", "Details", "Risk", ""].map((c) => (
              <th key={c} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {loading ? (
            <SkeletonRows cols={8} />
          ) : filtered.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No activity logs found.
              </td>
            </tr>
          ) : (
            filtered.map((row) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="p-3">
                  <input type="checkbox" title="Select" aria-label="Select" checked={selected2.has(row.id)} onChange={() => toggleSelect(row.id)} className="rounded" />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-sm">{row.actor_name ?? "Unknown"}</div>
                  <div className="text-[11px] text-muted-foreground">{row.actor_email ?? "-"}</div>
                </td>
                <td className="px-4 py-3">{statusBadge(row.action_type)}</td>
                <td className="px-4 py-3 text-sm capitalize">{row.module}</td>
                <td className="px-4 py-3 max-w-[300px]">
                  <div className="text-sm font-medium truncate">{row.message}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {row.entity_label ?? row.entity_type ?? "-"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge className={`border-0 text-[10px] ${row.risk_score >= 50 ? "bg-destructive/15 text-destructive" : row.risk_score >= 25 ? "bg-warning/15 text-warning" : "bg-muted/40 text-muted-foreground"}`}>
                    {row.risk_score}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5 justify-end">
                    <button type="button" onClick={() => setSelected(row)} title="View" aria-label="View" className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                      <Eye className="size-3.5" />
                    </button>
                    <button type="button" onClick={() => setConfirmDeleteId(row.id)} title="Delete" aria-label="Delete" className="p-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Activity Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="rounded-xl border border-border bg-card/50 p-3">
                <div className="font-semibold">{selected.message}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(selected.created_at).toLocaleString()}
                </div>
              </div>
              <pre className="max-h-[360px] overflow-auto rounded-xl bg-muted/30 p-3 text-xs">
                {JSON.stringify({ ...selected, details: selected.details }, null, 2)}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
