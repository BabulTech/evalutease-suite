import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { ReactNode } from "react";

function BarLabel({ x, y, width, value }: { x?: number; y?: number; width?: number; value?: number }) {
  if (value == null || !width) return null;
  return (
    <text x={(x ?? 0) + width / 2} y={(y ?? 0) - 4} textAnchor="middle" className="chart-bar-label" fontSize={10} fill="rgba(128,128,128,0.9)" fontWeight={600}>
      {value}
    </text>
  );
}

export type HistoryTrends = {
  weeklyAverage: { label: string; avgScore: number }[];
  weeklyParticipants: { label: string; participants: number }[];
  monthlyCompletion: { label: string; completionRate: number }[];
  monthlyQuizCount: { label: string; quizzes: number }[];
};

/* ── Label formatters ── */
function fmtWeek(label: string) {
  // "2026-W20" → "W20"
  const parts = label.split("-");
  return parts.length >= 2 ? parts[parts.length - 1] : label;
}

function fmtMonth(label: string) {
  // "2026-05" → "May"
  const [year, month] = label.split("-");
  if (!year || !month) return label;
  return new Date(Number(year), Number(month) - 1, 1).toLocaleString("default", { month: "short" });
}

/* ── Trend direction ── */
type TrendDir = "up" | "down" | "flat";

function trendDir(values: number[]): TrendDir {
  if (values.length < 2) return "flat";
  const delta = values[values.length - 1] - values[0];
  if (delta > 2) return "up";
  if (delta < -2) return "down";
  return "flat";
}

function TrendChip({ dir, unit = "" }: { dir: TrendDir; unit?: string }) {
  if (dir === "up")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-bold">
        <TrendingUp className="h-3 w-3" /> Improving
      </span>
    );
  if (dir === "down")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[10px] font-bold">
        <TrendingDown className="h-3 w-3" /> Declining
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 text-muted-foreground px-2 py-0.5 text-[10px] font-bold">
      <Minus className="h-3 w-3" /> Steady
    </span>
  );
}

/* ── Styled tooltip ── */
function ChartTooltip({
  active,
  payload,
  label,
  unit = "",
  labelFmt,
}: {
  active?: boolean;
  payload?: { value: number; color: string; name: string }[];
  label?: string;
  unit?: string;
  labelFmt?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-1 font-medium">
        {labelFmt && label ? labelFmt(label) : label}
      </p>
      {payload.map((p) => (
        <p key={p.name} className="font-bold text-foreground">
          {p.value}{unit}
        </p>
      ))}
    </div>
  );
}

/* ── Single chart card ── */
function TrendCard({
  title,
  subtitle,
  insight,
  trend,
  sparse,
  children,
}: {
  title: string;
  subtitle: string;
  insight?: string;
  trend?: TrendDir;
  sparse?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
          {insight && <p className="text-[11px] text-primary mt-1 font-medium">{insight}</p>}
        </div>
        {trend && !sparse && <TrendChip dir={trend} />}
      </div>
      {sparse ? (
        <div className="h-[160px] flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
          Not enough data yet — run more quizzes to see a trend
        </div>
      ) : (
        children
      )}
    </div>
  );
}

/* ── Main export ── */
export default function HistoryTrendCharts({ trends }: { trends: HistoryTrends }) {
  const wAvg = trends.weeklyAverage;
  const wPart = trends.weeklyParticipants;
  const mComp = trends.monthlyCompletion;
  const mQuiz = trends.monthlyQuizCount;

  const avgValues = wAvg.map((d) => d.avgScore);
  const partValues = wPart.map((d) => d.participants);
  const compValues = mComp.map((d) => d.completionRate);
  const quizValues = mQuiz.map((d) => d.quizzes);

  const peakAvg = avgValues.length ? Math.max(...avgValues) : 0;
  const latestAvg = avgValues.at(-1) ?? 0;
  const peakComp = compValues.length ? Math.max(...compValues) : 0;
  const totalParticipants = partValues.reduce((s, v) => s + v, 0);
  const totalQuizzes = quizValues.reduce((s, v) => s + v, 0);

  const avgColor = latestAvg >= 70 ? "#22c55e" : latestAvg >= 40 ? "#f59e0b" : "#ef4444";
  const avgFill = latestAvg >= 70 ? "#22c55e20" : latestAvg >= 40 ? "#f59e0b20" : "#ef444420";

  return (
    <div className="grid gap-3 sm:grid-cols-2 print:hidden">
      {/* 1 — Avg score trend */}
      <TrendCard
        title="Avg Score Over Time"
        subtitle="Weekly class average — are students improving?"
        insight={
          wAvg.length >= 2
            ? `Peak: ${peakAvg}% · Latest: ${latestAvg}%`
            : wAvg.length === 1
            ? `Current avg: ${latestAvg}%`
            : undefined
        }
        trend={trendDir(avgValues)}
        sparse={wAvg.length < 2}
      >
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={wAvg} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={avgColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={avgColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
            <XAxis
              dataKey="label"
              tickFormatter={fmtWeek}
              tick={{ fontSize: 10, fill: "rgba(128,128,128,0.8)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={32}
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "rgba(128,128,128,0.8)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<ChartTooltip unit="%" labelFmt={fmtWeek} />} />
            <ReferenceLine
              y={70}
              stroke="#22c55e"
              strokeDasharray="4 3"
              strokeOpacity={0.5}
              label={{ value: "Good", position: "insideTopRight", fontSize: 9, fill: "#22c55e" }}
            />
            <Area
              type="monotone"
              dataKey="avgScore"
              stroke={avgColor}
              strokeWidth={2.5}
              fill="url(#avgGrad)"
              dot={{ r: 3, fill: avgColor, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </TrendCard>

      {/* 2 — Participants per week */}
      <TrendCard
        title="Participants Per Week"
        subtitle="How many students are joining quizzes?"
        insight={
          wPart.length >= 1
            ? `${totalParticipants} total submissions · Avg ${Math.round(totalParticipants / Math.max(1, wPart.length))}/week`
            : undefined
        }
        trend={trendDir(partValues)}
        sparse={wPart.length < 2}
      >
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={wPart} margin={{ top: 16, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" vertical={false} />
            <XAxis
              dataKey="label"
              tickFormatter={fmtWeek}
              tick={{ fontSize: 10, fill: "rgba(128,128,128,0.8)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={32}
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "rgba(128,128,128,0.8)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip labelFmt={fmtWeek} />} />
            <Bar dataKey="participants" fill="#38bdf8" radius={[5, 5, 0, 0]}>
              <LabelList dataKey="participants" content={<BarLabel />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </TrendCard>

      {/* 3 — Completion rate */}
      <TrendCard
        title="Completion Rate by Month"
        subtitle="% of students who submitted before time ran out"
        insight={
          mComp.length >= 1
            ? `Best month: ${peakComp}% · Target: ≥80%`
            : undefined
        }
        trend={trendDir(compValues)}
        sparse={mComp.length < 2}
      >
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={mComp} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
            <XAxis
              dataKey="label"
              tickFormatter={fmtMonth}
              tick={{ fontSize: 10, fill: "rgba(128,128,128,0.8)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={32}
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "rgba(128,128,128,0.8)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<ChartTooltip unit="%" labelFmt={fmtMonth} />} />
            <ReferenceLine
              y={80}
              stroke="#f59e0b"
              strokeDasharray="4 3"
              strokeOpacity={0.5}
              label={{ value: "Target", position: "insideTopRight", fontSize: 9, fill: "#f59e0b" }}
            />
            <Area
              type="monotone"
              dataKey="completionRate"
              stroke="#f59e0b"
              strokeWidth={2.5}
              fill="url(#compGrad)"
              dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </TrendCard>

      {/* 4 — Quiz activity */}
      <TrendCard
        title="Quiz Activity by Month"
        subtitle="How frequently are you running quizzes?"
        insight={
          mQuiz.length >= 1
            ? `${totalQuizzes} total quizzes · Avg ${Math.round(totalQuizzes / Math.max(1, mQuiz.length))}/month`
            : undefined
        }
        trend={trendDir(quizValues)}
        sparse={mQuiz.length < 2}
      >
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={mQuiz} margin={{ top: 16, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" vertical={false} />
            <XAxis
              dataKey="label"
              tickFormatter={fmtMonth}
              tick={{ fontSize: 10, fill: "rgba(128,128,128,0.8)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={32}
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "rgba(128,128,128,0.8)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip labelFmt={fmtMonth} />} />
            <Bar dataKey="quizzes" fill="#a78bfa" radius={[5, 5, 0, 0]}>
              <LabelList dataKey="quizzes" content={<BarLabel />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </TrendCard>
    </div>
  );
}
