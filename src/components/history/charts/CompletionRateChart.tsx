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
import { fmtMonth, trendDir, TICK_STYLE, GRID_STROKE } from "./utils";

const COLOR = "#f59e0b";

type DataPoint = { label: string; completionRate: number };

type Props = { data: DataPoint[] };

export function CompletionRateChart({ data }: Props) {
  const values = data.map((d) => d.completionRate);
  const peak = values.length ? Math.max(...values) : 0;

  return (
    <TrendCard
      title="Completion Rate by Month"
      subtitle="% of students who submitted before time ran out"
      insight={data.length >= 1 ? `Best month: ${peak}% · Target: ≥80%` : undefined}
      trend={trendDir(values)}
      sparse={data.length < 2}
    >
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="compGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLOR} stopOpacity={0.25} />
              <stop offset="95%" stopColor={COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis
            dataKey="label"
            tickFormatter={fmtMonth}
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
          <Tooltip content={<ChartTooltip unit="%" labelFmt={fmtMonth} />} />
          <ReferenceLine
            y={80}
            stroke={COLOR}
            strokeDasharray="4 3"
            strokeOpacity={0.5}
            label={{ value: "Target", position: "insideTopRight", fontSize: 9, fill: COLOR }}
          />
          <Area
            type="monotone"
            dataKey="completionRate"
            stroke={COLOR}
            strokeWidth={2.5}
            fill="url(#compGrad)"
            dot={{ r: 3, fill: COLOR, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </TrendCard>
  );
}
