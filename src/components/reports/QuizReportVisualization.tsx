import { BarChart3, Flame, Target, Timer, Trophy, Users } from "lucide-react";
import { ShareResultCard } from "@/components/ShareResultCard";
import { formatDuration, type QuizReportRow } from "@/lib/quiz-reports";
import { SectionLabel } from "./visualization/SectionLabel";
import { Metric } from "./visualization/Metric";
import { AnswerMetric } from "./visualization/AnswerMetric";
import { DistributionBar } from "./visualization/DistributionBar";
import { TopPerformers } from "./visualization/TopPerformers";
import { QuizReportHeader, type VisualizationSession } from "./visualization/QuizReportHeader";

type VisualizationStats = {
  total: number;
  submitted: number;
  passRate: number;
  avgDuration: number | null;
  avg: number;
  best: number | null;
  median: number | null;
  worst: number | null;
  totals: { correct: number; wrong: number; unattempted: number };
  buckets: { top: number; pass: number; fail: number; left: number };
};

export default function QuizReportVisualization({
  session,
  top,
  filteredRows,
  stats,
  passMark,
  teacherName,
  schoolName,
}: {
  session: VisualizationSession;
  top: QuizReportRow | undefined;
  filteredRows: QuizReportRow[];
  stats: VisualizationStats;
  passMark: number;
  teacherName: string;
  schoolName: string;
}) {
  return (
    <>
      <QuizReportHeader
        session={session}
        top={top}
        teacherName={teacherName}
        schoolName={schoolName}
      />

      <SectionLabel
        title="Participation Overview"
        desc="How many students joined and actually submitted their answers."
      />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Metric
          icon={Users}
          label="Joined"
          value={stats.total}
          desc="Total participants who entered the quiz session"
        />
        <Metric
          icon={Trophy}
          label="Submitted"
          value={stats.submitted}
          desc="Participants who completed and submitted answers"
        />
        <Metric
          icon={Target}
          label="Pass rate"
          value={`${stats.passRate}%`}
          desc={`% who scored >= ${passMark}% (your current pass mark)`}
          color="text-primary"
        />
        <Metric
          icon={Timer}
          label="Avg time"
          value={stats.avgDuration === null ? "-" : formatDuration(stats.avgDuration)}
          desc="Average time taken to finish the quiz"
        />
      </div>

      <SectionLabel
        title="Score Performance"
        desc="How well participants scored - from the top to the lowest result."
      />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Metric
          icon={BarChart3}
          label="Class average"
          value={`${stats.avg}%`}
          desc="Mean score across all submitted attempts"
          color={stats.avg >= passMark ? "text-success" : "text-destructive"}
        />
        <Metric
          icon={Trophy}
          label="Highest score"
          value={stats.best === null ? "-" : `${stats.best}%`}
          desc="Best individual score in this session"
          color="text-success"
        />
        <Metric
          icon={BarChart3}
          label="Median score"
          value={stats.median === null ? "-" : `${stats.median}%`}
          desc="Middle value - half scored above this, half below"
        />
        <Metric
          icon={Flame}
          label="Lowest score"
          value={stats.worst === null ? "-" : `${stats.worst}%`}
          desc="Lowest individual score - shows who may need extra help"
          color="text-destructive"
        />
      </div>

      <SectionLabel
        title="Answer Breakdown"
        desc="Total correct, wrong, and skipped answers across all participants combined."
      />
      <div className="grid gap-3 md:grid-cols-3">
        <AnswerMetric
          label="Correct answers"
          value={stats.totals.correct}
          tone="success"
          desc="Questions answered correctly across all participants"
        />
        <AnswerMetric
          label="Wrong answers"
          value={stats.totals.wrong}
          tone="danger"
          desc="Incorrect answers - useful for spotting tricky questions"
        />
        <AnswerMetric
          label="Skipped / not attempted"
          value={stats.totals.unattempted}
          tone="muted"
          desc="Questions left blank - may indicate time pressure or confusion"
        />
      </div>

      <SectionLabel
        title="Score Distribution"
        desc="See how the class is spread across performance bands at a glance."
      />
      <DistributionBar buckets={stats.buckets} passMark={passMark} />

      {filteredRows.length > 0 && (
        <>
          <SectionLabel
            title="Top Performers"
            desc="The three highest-scoring participants in this session."
          />
          <TopPerformers rows={filteredRows} />
        </>
      )}

      <ShareResultCard
        mode="host"
        quizTitle={session.title}
        totalParticipants={stats.total}
        submitted={stats.submitted}
        avgPct={stats.avg}
        bestPct={stats.best ?? 0}
        passRate={stats.passRate}
        topScorer={filteredRows[0]?.name}
      />
    </>
  );
}
