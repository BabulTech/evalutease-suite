import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { RefreshCw, Zap, DollarSign, Hash, Coins, Settings2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// Cost per 1M tokens in USD - editable by admin in the UI
type ModelPricing = { input: number; output: number };
const DEFAULT_PRICING: Record<string, ModelPricing> = {
  "claude-haiku-4-5-20251001": { input: 0.8,  output: 4.0   },
  "claude-sonnet-4-6":         { input: 3.0,  output: 15.0  },
  "claude-opus-4-7":           { input: 15.0, output: 75.0  },
  "claude-3-5-sonnet":         { input: 3.0,  output: 15.0  },
  "claude-3-5-haiku":          { input: 0.8,  output: 4.0   },
  "claude-3-opus":             { input: 15.0, output: 75.0  },
  _default:                    { input: 0.8,  output: 4.0   },
};

function calcCostUsd(row: AiUsageRow, pricing: Record<string, ModelPricing>): number {
  const p = pricing[row.model] ?? pricing._default;
  return (row.input_tokens * p.input + row.output_tokens * p.output) / 1_000_000;
}

export function AiUsageSection() {
  const [rows, setRows] = useState<AiUsageRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [featureFilter, setFeatureFilter] = useState("all");

  // Pricing state - editable
  const [pricing, setPricing] = useState<Record<string, ModelPricing>>(DEFAULT_PRICING);
  const [showPricing, setShowPricing] = useState(false);

  // Live USD→PKR exchange rate
  const [usdToPkr, setUsdToPkr] = useState<number>(280);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState(false);

  const fetchRate = useCallback(async () => {
    setRateLoading(true);
    setRateError(false);
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      if (!res.ok) throw new Error("rate fetch failed");
      const json = await res.json() as { rates?: Record<string, number> };
      const pkr = json.rates?.PKR;
      if (pkr) setUsdToPkr(pkr);
      else throw new Error("no PKR rate");
    } catch {
      setRateError(true);
    } finally {
      setRateLoading(false);
    }
  }, []);

  useEffect(() => { void fetchRate(); }, [fetchRate]);

  const load = useCallback(async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("ai_usage_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (featureFilter !== "all") query = query.eq("feature", featureFilter);
    const { data, error } = await query;
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const usage = (data ?? []) as AiUsageRow[];
    setRows(usage);
    const ids = Array.from(new Set(usage.flatMap((r) => (r.actor_user_id ? [r.actor_user_id] : []))));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      const map: Record<string, { full_name: string | null; email: string | null }> = {};
      (profs ?? []).forEach((p) => { map[p.id] = { full_name: p.full_name, email: p.email }; });
      setProfiles(map);
    }
  }, [featureFilter]);

  useEffect(() => { void load(); }, [load]);

  const features = useMemo(() => Array.from(new Set(rows.map((r) => r.feature))).sort(), [rows]);
  const models = useMemo(() => Array.from(new Set(rows.map((r) => r.model))).sort(), [rows]);

  const totalCostUsd = useMemo(() => rows.reduce((s, r) => s + calcCostUsd(r, pricing), 0), [rows, pricing]);
  const totalTokens = useMemo(() => rows.reduce((s, r) => s + Number(r.total_tokens ?? 0), 0), [rows]);
  const totalCredits = useMemo(() => rows.reduce((s, r) => s + Number(r.credits_charged ?? 0), 0), [rows]);

  const fmtUsd = (v: number) => `$${v.toFixed(4)}`;
  const fmtPkr = (v: number) => `Rs ${(v * usdToPkr).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHead title="AI Usage" aria-label="AI Usage" sub="Token usage, credit burn, estimated AI cost by model (live pricing)." />
        <div className="flex gap-2">
          <Select value={featureFilter} onValueChange={setFeatureFilter}>
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Feature" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All features</SelectItem>
              {features.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setShowPricing((v) => !v)} className="gap-2">
            <Settings2 className="size-4" /> Pricing
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-2">
            <RefreshCw className="size-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* Exchange rate bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground">
        <span className="font-medium text-foreground">USD → PKR</span>
        <input
          type="number"
          title="USD to PKR rate" aria-label="USD to PKR rate"
          value={usdToPkr}
          onChange={(e) => setUsdToPkr(Number(e.target.value))}
          className="w-24 h-7 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
          step="0.01"
        />
        <button
          type="button"
          onClick={() => void fetchRate()}
          disabled={rateLoading}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border hover:bg-muted/40 disabled:opacity-50"
        >
          <RefreshCw className={`size-3 ${rateLoading ? "animate-spin" : ""}`} />
          {rateLoading ? "Fetching…" : "Refresh rate"}
        </button>
        {rateError && <span className="text-destructive">Could not fetch live rate (using manual value).</span>}
        <span className="ml-auto text-[11px]">Source: open.er-api.com</span>
      </div>

      {/* Editable pricing table */}
      {showPricing && (
        <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Per-model pricing (USD per 1M tokens)</p>
            <button type="button" title="Close pricing" aria-label="Close pricing" onClick={() => setShowPricing(false)} className="p-1 rounded-lg text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">Model</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">Input ($/1M)</th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">Output ($/1M)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {Object.keys(pricing).map((model) => (
                  <tr key={model}>
                    <td className="px-3 py-2 font-mono">{model === "_default" ? "Default (fallback)" : model}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        title={`${model} input price`}
                        value={pricing[model].input}
                        step="0.01"
                        min="0"
                        onChange={(e) => setPricing((p) => ({ ...p, [model]: { ...p[model], input: Number(e.target.value) } }))}
                        className="w-24 h-7 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        title={`${model} output price`}
                        value={pricing[model].output}
                        step="0.01"
                        min="0"
                        onChange={(e) => setPricing((p) => ({ ...p, [model]: { ...p[model], output: Number(e.target.value) } }))}
                        className="w-24 h-7 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </td>
                  </tr>
                ))}
                {/* Add rows for any models in data not yet in pricing table */}
                {models.flatMap((model) =>
                  model in pricing
                    ? []
                    : [
                        <tr key={model} className="bg-warning/5">
                          <td className="px-3 py-2 font-mono">{model} <span className="text-warning">(using default)</span></td>
                          <td className="px-3 py-2 text-muted-foreground">{pricing._default.input}</td>
                          <td className="px-3 py-2 text-muted-foreground">{pricing._default.output}</td>
                        </tr>,
                      ],
                )}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => setPricing(DEFAULT_PRICING)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Reset to defaults
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="AI calls" value={rows.length} icon={Zap} color="text-primary" />
        <StatCard label={`Cost (${fmtUsd(totalCostUsd)})`} value={fmtPkr(totalCostUsd)} icon={DollarSign} color="text-warning" />
        <StatCard label="Tokens" value={totalTokens.toLocaleString()} icon={Hash} color="text-success" />
        <StatCard label="Credits charged" value={totalCredits} icon={Coins} color="text-primary" />
      </div>

      <TableShell footer={`Latest 500 AI requests · rate: 1 USD = ${usdToPkr.toFixed(2)} PKR`}>
        <THead cols={["When", "User", "Feature / Model", "Tokens (in/out)", "Cost USD", "Cost PKR", "Credits", "Status"]} />
        <tbody className="divide-y divide-border">
          {loading ? (
            <SkeletonRows cols={8} />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No AI usage yet.</td>
            </tr>
          ) : (
            rows.map((row) => {
              const user = row.actor_user_id ? profiles[row.actor_user_id] : null;
              const costUsd = calcCostUsd(row, pricing);
              const costPkr = costUsd * usdToPkr;
              return (
                <tr key={row.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-sm">{user?.full_name ?? user?.email ?? row.actor_user_id ?? "Unknown"}</div>
                    <div className="text-[11px] text-muted-foreground">{user?.email ?? "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">{row.feature}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{row.model}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium">{Number(row.total_tokens ?? 0).toLocaleString()}</div>
                    <div className="text-muted-foreground">↑{row.input_tokens} ↓{row.output_tokens}</div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-warning whitespace-nowrap">
                    ${costUsd.toFixed(6)}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium whitespace-nowrap">
                    Rs {costPkr.toLocaleString("en-PK", { maximumFractionDigits: 2 })}
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
