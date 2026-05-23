import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { RefreshCw, Search, Activity, AlertTriangle, Layers, Users, Eye } from "lucide-react";
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
import { StatCard, TableShell, THead, SkeletonRows, SectionHead } from "./-shared";
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
  const [selected, setSelected] = useState<ActivityLogRow | null>(null);
  const debouncedSearch = useDebouncedValue(search, 250);

  const load = useCallback(async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(250);
    if (moduleFilter !== "all") query = query.eq("module", moduleFilter);
    if (actionFilter !== "all") query = query.eq("action_type", actionFilter);
    if (debouncedSearch.trim()) {
      const s = debouncedSearch.trim();
      query = query.or(
        `actor_name.ilike.%${s}%,actor_email.ilike.%${s}%,message.ilike.%${s}%,entity_label.ilike.%${s}%`,
      );
    }
    const { data, error } = await query;
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as ActivityLogRow[]);
  }, [debouncedSearch, moduleFilter, actionFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const modules = Array.from(new Set(rows.map((r) => r.module))).sort();
  const actions = Array.from(new Set(rows.map((r) => r.action_type))).sort();
  const highRisk = rows.filter((r) => r.risk_score >= 50).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHead title="Activity Logs" sub="Who did what, when, and on which record." />
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-2">
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Loaded events" value={rows.length} icon={Activity} />
        <StatCard
          label="High risk"
          value={highRisk}
          icon={AlertTriangle}
          color="text-destructive"
        />
        <StatCard label="Modules" value={modules.length} icon={Layers} color="text-primary" />
        <StatCard
          label="Users active"
          value={new Set(rows.flatMap((r) => (r.actor_user_id ? [r.actor_user_id] : []))).size}
          icon={Users}
          color="text-success"
        />
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_180px_180px]">
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
          <SelectTrigger>
            <SelectValue placeholder="Module" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {modules.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TableShell footer="Latest 250 matching activity events">
        <THead cols={["When", "User", "Action", "Module", "Details", "Risk", ""]} />
        <tbody className="divide-y divide-border">
          {loading ? (
            <SkeletonRows cols={7} />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No activity logs found.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-sm">{row.actor_name ?? "Unknown"}</div>
                  <div className="text-[11px] text-muted-foreground">{row.actor_email ?? "-"}</div>
                </td>
                <td className="px-4 py-3">{statusBadge(row.action_type)}</td>
                <td className="px-4 py-3 text-sm capitalize">{row.module}</td>
                <td className="px-4 py-3 max-w-[360px]">
                  <div className="text-sm font-medium truncate">{row.message}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {row.entity_label ?? row.entity_type ?? "-"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    className={`border-0 text-[10px] ${row.risk_score >= 50 ? "bg-destructive/15 text-destructive" : row.risk_score >= 25 ? "bg-warning/15 text-warning" : "bg-muted/40 text-muted-foreground"}`}
                  >
                    {row.risk_score}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(row)}
                    className="gap-1"
                  >
                    <Eye className="size-3.5" /> View
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
      >
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
