import type { HistoryTrends } from "./charts/types";
import { AvgScoreChart } from "./charts/AvgScoreChart";
import { ParticipantsChart } from "./charts/ParticipantsChart";
import { CompletionRateChart } from "./charts/CompletionRateChart";
import { QuizActivityChart } from "./charts/QuizActivityChart";

export type { HistoryTrends };

export default function HistoryTrendCharts({ trends }: { trends: HistoryTrends }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 print:hidden">
      <AvgScoreChart data={trends.weeklyAverage} />
      <ParticipantsChart data={trends.weeklyParticipants} />
      <CompletionRateChart data={trends.monthlyCompletion} />
      <QuizActivityChart data={trends.monthlyQuizCount} />
    </div>
  );
}
