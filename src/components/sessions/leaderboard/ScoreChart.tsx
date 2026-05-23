// react-doctor-disable-next-line react-doctor/prefer-dynamic-import
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartEntry = {
  rank: number;
  name: string;
  fullName: string;
  score: number;
  completed: boolean;
};

type Props = { data: ChartEntry[]; maxScore: number };

export function ScoreChart({ data, maxScore }: Props) {
  const chartHeight = Math.max(220, Math.min(560, data.length * 44));
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Top {data.length} scores chart
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 28, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, Math.ceil(maxScore * 1.15)]}
            stroke="rgba(255,255,255,0.4)"
            fontSize={11}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="rgba(255,255,255,0.6)"
            fontSize={12}
            width={110}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            contentStyle={{
              background: "rgb(20 26 40)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, _key, ctx) => [
              `${value} pts${ctx.payload.completed ? "" : " (still playing)"}`,
              ctx.payload.fullName,
            ]}
            labelFormatter={() => ""}
          />
          <Bar dataKey="score" radius={[0, 8, 8, 0]} barSize={28}>
            {data.map((entry, idx) => (
              <Cell
                key={entry.name + idx}
                fill={
                  idx === 0
                    ? "oklch(0.82 0.16 180)"
                    : idx === 1
                      ? "oklch(0.7 0.14 200)"
                      : idx === 2
                        ? "oklch(0.62 0.13 220)"
                        : entry.completed
                          ? "oklch(0.46 0.06 240)"
                          : "oklch(0.36 0.05 250)"
                }
              />
            ))}
            <LabelList
              dataKey="score"
              position="right"
              fill="rgba(255,255,255,0.85)"
              fontSize={12}
              fontWeight="bold"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type { ChartEntry };
