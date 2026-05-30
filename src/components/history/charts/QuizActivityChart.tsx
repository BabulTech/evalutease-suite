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
import { fmtMonth, trendDir, TICK_STYLE, GRID_STROKE } from "./utils";

type DataPoint = { label: string; quizzes: number };

type Props = { data: DataPoint[] };

export function QuizActivityChart({ data }: Props) {
  const values = data.map((d) => d.quizzes);
  const total = values.reduce((s, v) => s + v, 0);

  return (
    <TrendCard
      title="Quiz Activity by Month"
      subtitle="How frequently are you running quizzes?"
      insight={
        data.length >= 1
          ? `${total} total quizzes · Avg ${Math.round(total / Math.max(1, data.length))}/month`
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
            tickFormatter={fmtMonth}
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
          <Tooltip content={<ChartTooltip labelFmt={fmtMonth} />} />
          <Bar dataKey="quizzes" fill="#a78bfa" radius={[5, 5, 0, 0]}>
            <LabelList dataKey="quizzes" content={<BarLabel />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </TrendCard>
  );
}
