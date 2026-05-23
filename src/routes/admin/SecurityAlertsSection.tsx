import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { RefreshCw, AlertTriangle, Shield, TrendingUp, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard, SectionHead } from "./-shared";
import { statusBadge } from "./helpers";

type SecurityAlertRow = {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  alert_type: string;
  actor_user_id: string | null;
  title: string;
  message: string;
  details: Record<string, unknown>;
  status: string;
  created_at: string;
};

export function SecurityAlertsSection({
  onOpenCountChange,
}: {
  onOpenCountChange?: (count: number) => void;
}) {
  const [rows, setRows] = useState<SecurityAlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("open");

  const load = useCallback(async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("security_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(250);
    if (status !== "all") query = query.eq("status", status);
    const { data, error } = await query;
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const nextRows = (data ?? []) as SecurityAlertRow[];
    setRows(nextRows);
    if (status === "open") onOpenCountChange?.(nextRows.length);
  }, [status, onOpenCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (id: string, next: "reviewed" | "dismissed") => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("security_alerts")
      .update({
        status: next,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((prev) => {
      const updated = prev.map((r) => (r.id === id ? { ...r, status: next } : r));
      onOpenCountChange?.(updated.filter((r) => r.status === "open").length);
      return updated;
    });
    toast.success(`Alert marked ${next}`);
  };

  const severityClass: Record<string, string> = {
    low: "bg-muted/40 text-muted-foreground",
    medium: "bg-warning/15 text-warning",
    high: "bg-destructive/15 text-destructive",
    critical: "bg-destructive text-destructive-foreground",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHead
          title="Security Alerts"
          sub="Smart flags for AI overuse, cost spikes, bulk actions, and unusual behavior."
        />
        <div className="flex gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-2">
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard
          label="Open alerts loaded"
          value={rows.filter((r) => r.status === "open").length}
          icon={AlertTriangle}
          color="text-destructive"
        />
        <StatCard
          label="Critical"
          value={rows.filter((r) => r.severity === "critical").length}
          icon={Shield}
          color="text-destructive"
        />
        <StatCard
          label="High"
          value={rows.filter((r) => r.severity === "high").length}
          icon={TrendingUp}
          color="text-warning"
        />
        <StatCard label="Total loaded" value={rows.length} icon={Activity} />
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-border bg-card/50 p-8 text-center text-muted-foreground animate-pulse">
            Loading alerts…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
            <Shield className="mx-auto size-10 text-success mb-3" />
            <p className="font-semibold">No alerts found</p>
            <p className="text-sm text-muted-foreground mt-1">
              The current filter has no suspicious activity.
            </p>
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-border bg-card/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={`${severityClass[row.severity]} border-0 text-[10px] uppercase`}
                    >
                      {row.severity}
                    </Badge>
                    {statusBadge(row.status)}
                    <span className="text-xs text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="font-semibold mt-2">{row.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{row.message}</p>
                  <div className="text-[11px] text-muted-foreground mt-2">
                    Type: {row.alert_type}
                  </div>
                </div>
                {row.status === "open" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void updateStatus(row.id, "reviewed")}
                    >
                      Review
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void updateStatus(row.id, "dismissed")}
                    >
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
