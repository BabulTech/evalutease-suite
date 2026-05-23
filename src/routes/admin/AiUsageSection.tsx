import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { RefreshCw, Zap, DollarSign, Hash, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard, TableShell, THead, SkeletonRows, SectionHead } from "./-shared";
import { statusBadge } from "./helpers";

type AiUsageRow = {
  id: string;
  actor_user_id: string | null;
  plan_owner_id: string | null;
  feature: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  currency: string;
  credits_charged: number;
  request_status: string;
  details: Record<string, unknown>;
  created_at: string;
};

export function AiUsageSection() {
  const [rows, setRows] = useState<AiUsageRow[]>([]);
  const [profiles, setProfiles] = useState<
    Record<string, { full_name: string | null; email: string | null }>
  >({});
  const [loading, setLoading] = useState(true);
  const [featureFilter, setFeatureFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("ai_usage_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(250);
    if (featureFilter !== "all") query = query.eq("feature", featureFilter);
    const { data, error } = await query;
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const usage = (data ?? []) as AiUsageRow[];
    setRows(usage);
    const ids = Array.from(
      new Set(usage.flatMap((r) => (r.actor_user_id ? [r.actor_user_id] : []))),
    );
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,full_name,email")
        .in("id", ids);
      const map: Record<string, { full_name: string | null; email: string | null }> = {};
      (profs ?? []).forEach((p) => {
        map[p.id] = { full_name: p.full_name, email: p.email };
      });
      setProfiles(map);
    }
  }, [featureFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const features = Array.from(new Set(rows.map((r) => r.feature))).sort();
  const totalCost = rows.reduce((s, r) => s + Number(r.estimated_cost ?? 0), 0);
  const totalTokens = rows.reduce((s, r) => s + Number(r.total_tokens ?? 0), 0);
  const totalCredits = rows.reduce((s, r) => s + Number(r.credits_charged ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHead
          title="AI Usage"
          sub="Token usage, credit burn, estimated AI cost, and top AI features."
        />
        <div className="flex gap-2">
          <Select value={featureFilter} onValueChange={setFeatureFilter}>
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Feature" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All features</SelectItem>
              {features.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-2">
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="AI calls" value={rows.length} icon={Zap} color="text-primary" />
        <StatCard
          label="Estimated cost"
          value={`$${totalCost.toFixed(4)}`}
          icon={DollarSign}
          color="text-warning"
        />
        <StatCard
          label="Tokens"
          value={totalTokens.toLocaleString()}
          icon={Hash}
          color="text-success"
        />
        <StatCard label="Credits charged" value={totalCredits} icon={Coins} color="text-primary" />
      </div>

      <TableShell footer="Latest 250 AI requests">
        <THead cols={["When", "User", "Feature", "Tokens", "Cost", "Credits", "Status"]} />
        <tbody className="divide-y divide-border">
          {loading ? (
            <SkeletonRows cols={7} />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No AI usage yet.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const user = row.actor_user_id ? profiles[row.actor_user_id] : null;
              return (
                <tr key={row.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-sm">
                      {user?.full_name ?? user?.email ?? row.actor_user_id ?? "Unknown"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{user?.email ?? "-"}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">{row.feature}</td>
                  <td className="px-4 py-3 text-sm">
                    <div>{Number(row.total_tokens ?? 0).toLocaleString()}</div>
                    <div className="text-[11px] text-muted-foreground">
                      in {row.input_tokens} / out {row.output_tokens}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold">
                    ${Number(row.estimated_cost ?? 0).toFixed(6)}
                  </td>
                  <td className="px-4 py-3 text-sm">{row.credits_charged}</td>
                  <td className="px-4 py-3">{statusBadge(row.request_status)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </TableShell>
    </div>
  );
}
