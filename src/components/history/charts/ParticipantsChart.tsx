// react-doctor-disable-next-line react-doctor/prefer-dynamic-import
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendCard } from "./TrendCard";
import { ChartTooltip } from "./ChartTooltip";
import { BarLabel } from "./BarLabel";
import { fmtWeek, trendDir, TICK_STYLE, GRID_STROKE } from "./utils";

type DataPoint = { label: string; participants: number };

type Props = { data: DataPoint[] };

export function ParticipantsChart({ data }: Props) {
  const values = data.map((d) => d.participants);
  const total = values.reduce((s, v) => s + v, 0);

  return (
    <TrendCard
      title="Participants Per Week"
      subtitle="How many students are joining quizzes?"
      insight={
        data.length >= 1
          ? `${total} total submissions · Avg ${Math.round(total / Math.max(1, data.length))}/week`
          : undefined
      }
      trend={trendDir(values)}
      sparse={data.length < 1}
    >
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 16, right: 4, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
          <XAxis
            dataKey="label"
            tickFormatter={fmtWeek}
            tick={TICK_STYLE}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={32}
            allowDecimals={false}
            tick={TICK_STYLE}
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
  );
}
