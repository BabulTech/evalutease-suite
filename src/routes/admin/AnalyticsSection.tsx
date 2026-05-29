import { useEffect, useState, useMemo } from "react";
import {
  Users,
  UserPlus,
  Activity,
  Smartphone,
  Apple,
  Globe,
  PlayCircle,
  Zap,
  DollarSign,
  RefreshCw,
  Crown,
  TrendingUp,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatCard, SectionHead } from "./-shared";

type Analytics = {
  users: {
    total: number; new_24h: number; new_7d: number; new_30d: number;
    online_now: number; dau: number; wau: number; mau: number;
  };
  installs: { android: number; ios: number; web: number };
  content: {
    total_quizzes: number; quizzes_24h: number; quizzes_7d: number;
    total_questions: number; total_participants: number;
    ai_calls_7d: number; ai_cost_7d_usd: number;
  };
  revenue: { total_pkr: number; last_7d_pkr: number; pending: number };
  series: {
    signups:  Array<{ day: string; count: number }>;
    activity: Array<{ day: string; count: number }>;
    installs: Array<{ day: string; count: number }>;
    revenue:  Array<{ day: string; amount: number }>;
  };
  plans:     Array<{ plan: string; count: number }>;
  top_users: Array<{ user_id: string; name: string; email: string; actions: number }>;
  generated_at: string;
};

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtPkr(n: number): string {
  return `PKR ${n.toLocaleString()}`;
}

function fmtDay(d: string): string {
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// Merge two series so charts share a single x-axis
function mergeSeries<A extends { day: string }, B extends { day: string }>(
  a: A[], b: B[],
): Array<A & B & { day: string }> {
  const map = new Map<string, A & B & { day: string }>();
  a.forEach((row) => map.set(row.day, { ...(row as A & B), day: row.day }));
  b.forEach((row) => {
    const existing = map.get(row.day);
    if (existing) Object.assign(existing, row);
    else map.set(row.day, { ...(row as A & B), day: row.day });
  });
  return [...map.values()].sort((x, y) => x.day.localeCompare(y.day));
}

export function AnalyticsSection() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: r, error: err } = await (supabase as any).rpc("get_app_analytics");
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setData(r as Analytics);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);

  // Build merged signups + activity series for the main chart
  const userChartData = useMemo(() => {
    if (!data) return [];
    return mergeSeries(
      data.series.signups.map((s) => ({ day: s.day, signups: s.count })),
      data.series.activity.map((a) => ({ day: a.day, active: a.count })),
    );
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted/30 animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-muted/30 animate-pulse" />
        <div className="h-64 rounded-2xl bg-muted/30 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 text-sm text-destructive">
        Failed to load analytics: {error}
        <Button onClick={() => void load()} variant="outline" size="sm" className="mt-3">
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
        <SectionHead
          title="Analytics"
          sub={`Real-time platform metrics — generated ${new Date(data.generated_at).toLocaleTimeString()}`}
        />
        <Button onClick={() => void load()} variant="outline" size="sm" className="gap-1.5 shrink-0">
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      {/* ── Top KPIs — Users ─────────────────────────────── */}
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary opacity-70 mb-2 px-1">
          Users
        </h3>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Users"      value={fmtNum(data.users.total)}     icon={Users}     color="text-primary" />
          <StatCard label="Currently Online" value={data.users.online_now}        icon={Activity}  color="text-success" sub="active in last 5 min" />
          <StatCard label="New Signups (7d)" value={data.users.new_7d}            icon={UserPlus}  color="text-warning" sub={`${data.users.new_24h} today`} />
          <StatCard label="MAU"              value={fmtNum(data.users.mau)}       icon={TrendingUp} color="text-primary" sub={`DAU ${data.users.dau} · WAU ${data.users.wau}`} />
        </div>
      </div>

      {/* ── Active Users + Signups time series ─────────── */}
      <div className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Active Users + Signups (last 30 days)</h3>
        </div>
        {userChartData.length > 0 ? (
          <div className="h-64 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={userChartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickFormatter={fmtDay} tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <Tooltip
                  contentStyle={{ background: "#0b1220", border: "1px solid #1f2937", borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(v) => new Date(v).toLocaleDateString()}
                />
                <Area type="monotone" dataKey="active"  name="Active users" stroke="#2dd4bf" fill="#2dd4bf33" strokeWidth={2} />
                <Area type="monotone" dataKey="signups" name="New signups"  stroke="#f59e0b" fill="#f59e0b33" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-10">No activity yet</p>
        )}
      </div>

      {/* ── Installs by platform ───────────────────────── */}
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary opacity-70 mb-2 px-1">
          App installs
        </h3>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3">
          <StatCard label="Android" value={data.installs.android} icon={Smartphone} color="text-success" sub="installed APKs" />
          <StatCard label="iOS"     value={data.installs.ios}     icon={Apple}      color="text-foreground" sub="installed apps" />
          <StatCard label="Web Push" value={data.installs.web}    icon={Globe}      color="text-primary" sub="PWA subscribers" />
        </div>

        {data.series.installs.length > 0 && (
          <div className="mt-3 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
            <h3 className="text-sm font-semibold mb-3">Daily new installs (last 30 days)</h3>
            <div className="h-48 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.series.installs} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={fmtDay} tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <Tooltip
                    contentStyle={{ background: "#0b1220", border: "1px solid #1f2937", borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(v) => new Date(v).toLocaleDateString()}
                  />
                  <Bar dataKey="count" name="Installs" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ── Content + AI usage ─────────────────────────── */}
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary opacity-70 mb-2 px-1">
          Content &amp; AI
        </h3>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Quiz Sessions"  value={fmtNum(data.content.total_quizzes)}      icon={PlayCircle} color="text-primary" sub={`${data.content.quizzes_7d} this week`} />
          <StatCard label="Questions Bank" value={fmtNum(data.content.total_questions)}    icon={Crown}      color="text-warning" />
          <StatCard label="Participants"   value={fmtNum(data.content.total_participants)} icon={Users}      color="text-success" />
          <StatCard label="AI Calls (7d)"  value={fmtNum(data.content.ai_calls_7d)}        icon={Zap}        color="text-primary" sub={`$${data.content.ai_cost_7d_usd.toFixed(2)} cost`} />
        </div>
      </div>

      {/* ── Revenue ────────────────────────────────────── */}
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary opacity-70 mb-2 px-1">
          Revenue
        </h3>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-3">
          <StatCard label="Total Revenue"     value={fmtPkr(data.revenue.total_pkr)}   icon={DollarSign} color="text-success" />
          <StatCard label="Last 7 Days"       value={fmtPkr(data.revenue.last_7d_pkr)} icon={TrendingUp} color="text-primary" />
          <StatCard label="Pending Payments"  value={data.revenue.pending}             icon={DollarSign} color="text-warning" sub="awaiting approval" />
        </div>

        {data.series.revenue.length > 0 && (
          <div className="mt-3 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
            <h3 className="text-sm font-semibold mb-3">Daily revenue (last 30 days)</h3>
            <div className="h-48 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.series.revenue} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={fmtDay} tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ background: "#0b1220", border: "1px solid #1f2937", borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(v) => new Date(v).toLocaleDateString()}
                    formatter={(v: number) => fmtPkr(v)}
                  />
                  <Line type="monotone" dataKey="amount" name="Revenue (PKR)" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ── Plan distribution + Top users ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-3">Plan distribution</h3>
          <ul className="space-y-2">
            {data.plans.length === 0 ? (
              <li className="text-sm text-muted-foreground">No active subscriptions yet.</li>
            ) : (
              data.plans.map((p) => {
                const totalActive = data.plans.reduce((s, x) => s + x.count, 0);
                const pct = totalActive > 0 ? (p.count / totalActive) * 100 : 0;
                return (
                  <li key={p.plan} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate min-w-0 flex-1">{p.plan}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">
                        {p.count} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                      <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-3">Top users (last 30 days)</h3>
          {data.top_users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-border/40">
              {data.top_users.map((u, i) => (
                <li key={u.user_id} className="py-2 flex items-center gap-3 min-w-0">
                  <span className="size-6 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{u.name ?? "-"}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{u.email ?? "-"}</div>
                  </div>
                  <span className="text-xs font-bold text-primary shrink-0">{u.actions}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
