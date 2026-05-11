import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";

export type HistoryTrends = {
  weeklyAverage: { label: string; avgScore: number }[];
  weeklyParticipants: { label: string; participants: number }[];
  monthlyCompletion: { label: string; completionRate: number }[];
  monthlyQuizCount: { label: string; quizzes: number }[];
};

export default function HistoryTrendCharts({ trends }: { trends: HistoryTrends }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 print:hidden">
      <TrendCard title="Average score by week">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trends.weeklyAverage}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="label" hide />
            <YAxis width={36} />
            <Tooltip />
            <Line type="monotone" dataKey="avgScore" stroke="#22c55e" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </TrendCard>
      <TrendCard title="Participants by week">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={trends.weeklyParticipants}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="label" hide />
            <YAxis width={36} />
            <Tooltip />
            <Bar dataKey="participants" fill="#38bdf8" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </TrendCard>
      <TrendCard title="Completion rate by month">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={trends.monthlyCompletion}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="label" hide />
            <YAxis width={36} domain={[0, 100]} />
            <Tooltip />
            <Line type="monotone" dataKey="completionRate" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </TrendCard>
      <TrendCard title="Quiz count over time">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={trends.monthlyQuizCount}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="label" hide />
            <YAxis width={36} />
            <Tooltip />
            <Bar dataKey="quizzes" fill="#a78bfa" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </TrendCard>
    </div>
  );
}

function TrendCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}
