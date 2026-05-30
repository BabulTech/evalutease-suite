// react-doctor-disable-next-line react-doctor/prefer-dynamic-import
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendCard } from "./TrendCard";
import { ChartTooltip } from "./ChartTooltip";
import { fmtWeek, trendDir, TICK_STYLE, GRID_STROKE } from "./utils";

type DataPoint = { label: string; avgScore: number };

type Props = { data: DataPoint[] };

export function AvgScoreChart({ data }: Props) {
  const values = data.map((d) => d.avgScore);
  const peakAvg = values.length ? Math.max(...values) : 0;
  const latestAvg = values.at(-1) ?? 0;

  const color = latestAvg >= 70 ? "#22c55e" : latestAvg >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <TrendCard
      title="Avg Score Over Time"
      subtitle="Weekly class average, are students improving?"
      insight={
        data.length >= 2
          ? `Peak: ${peakAvg}% · Latest: ${latestAvg}%`
          : data.length === 1
            ? `Current avg: ${latestAvg}%`
            : undefined
      }
      trend={trendDir(values)}
      sparse={data.length < 1}
    >
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="avgGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis
            dataKey="label"
            tickFormatter={fmtWeek}
            tick={TICK_STYLE}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={32}
            domain={[0, 100]}
            tick={TICK_STYLE}
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
            stroke={color}
            strokeWidth={2.5}
            fill="url(#avgGrad)"
            dot={{ r: 3, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </TrendCard>
  );
}
