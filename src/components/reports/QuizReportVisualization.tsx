import { BarChart3, Flame, Target, Timer, Trophy, Users } from "lucide-react";
import { ShareResultCard } from "@/components/ShareResultCard";
import { formatDuration, type QuizReportRow } from "@/lib/quiz-reports";

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

type VisualizationSession = {
  title: string;
  created_at: string;
  categoryName: string;
  subcategoryName: string;
  subject: string | null;
  topic: string | null;
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
        <Metric icon={Users} label="Joined" value={stats.total}
          desc="Total participants who entered the quiz session" />
        <Metric icon={Trophy} label="Submitted" value={stats.submitted}
          desc="Participants who completed and submitted answers" />
        <Metric icon={Target} label="Pass rate" value={`${stats.passRate}%`}
          desc={`% who scored >= ${passMark}% (your current pass mark)`} color="text-primary" />
        <Metric icon={Timer} label="Avg time" value={stats.avgDuration === null ? "-" : formatDuration(stats.avgDuration)}
          desc="Average time taken to finish the quiz" />
      </div>

      <SectionLabel
        title="Score Performance"
        desc="How well participants scored - from the top to the lowest result."
      />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Metric icon={BarChart3} label="Class average" value={`${stats.avg}%`}
          desc="Mean score across all submitted attempts" color={stats.avg >= passMark ? "text-success" : "text-destructive"} />
        <Metric icon={Trophy} label="Highest score" value={stats.best === null ? "-" : `${stats.best}%`}
          desc="Best individual score in this session" color="text-success" />
        <Metric icon={BarChart3} label="Median score" value={stats.median === null ? "-" : `${stats.median}%`}
          desc="Middle value - half scored above this, half below" />
        <Metric icon={Flame} label="Lowest score" value={stats.worst === null ? "-" : `${stats.worst}%`}
          desc="Lowest individual score - shows who may need extra help" color="text-destructive" />
      </div>

      <SectionLabel
        title="Answer Breakdown"
        desc="Total correct, wrong, and skipped answers across all participants combined."
      />
      <div className="grid gap-3 md:grid-cols-3">
        <AnswerMetric label="Correct answers" value={stats.totals.correct} tone="success"
          desc="Questions answered correctly across all participants" />
        <AnswerMetric label="Wrong answers" value={stats.totals.wrong} tone="danger"
          desc="Incorrect answers - useful for spotting tricky questions" />
        <AnswerMetric label="Skipped / not attempted" value={stats.totals.unattempted} tone="muted"
          desc="Questions left blank - may indicate time pressure or confusion" />
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
          <div className="grid gap-3 md:grid-cols-3">
            {filteredRows.slice(0, 3).map((row, i) => {
              const medals = ["🥇", "🥈", "🥉"];
              const borders = ["border-warning/50 bg-warning/5", "border-muted-foreground/30 bg-muted/10", "border-orange-400/30 bg-orange-400/5"];
              return (
                <div key={row.id} className={`rounded-2xl border p-5 space-y-2 ${borders[i] ?? "border-border bg-card/50"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{medals[i]}</span>
                    <span className="text-xs text-muted-foreground font-medium">#{row.rank} place</span>
                  </div>
                  <div className="font-display font-bold text-lg leading-tight">{row.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{row.email || "No email provided"}</div>
                  <div className="flex items-baseline gap-2 pt-1">
                    <span className="font-display text-2xl font-bold text-success">{row.score}</span>
                    <span className="text-xs text-muted-foreground">pts · {row.percent}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted/30">
                    <div className="h-full rounded-full bg-success transition-all" style={{ width: `${row.percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
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

function SectionLabel({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 pt-1">
      <div className="h-6 w-1 rounded-full bg-primary mt-0.5 shrink-0" />
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </div>
  );
}

function QuizReportHeader({
  session,
  top,
  teacherName,
  schoolName,
}: {
  session: VisualizationSession;
  top: QuizReportRow | undefined;
  teacherName: string;
  schoolName: string;
}) {
  const category = [session.categoryName, session.subcategoryName].filter(Boolean).join(" -> ");
  const subject = session.subject || category || "Not specified";
  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card/60 to-card/40 p-6 print:border-0 print:bg-transparent print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Trophy className="h-3 w-3" /> Final Quiz Report
          </div>
          <h2 className="font-display text-2xl font-bold leading-tight">{session.title}</h2>
          <p className="text-xs text-muted-foreground">
            Held on {new Date(session.created_at).toLocaleString()} {category ? `· ${category}` : ""}
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2 md:grid-cols-4">
            <ReportDetail label="Teacher" value={teacherName} />
            <ReportDetail label="School / Org" value={schoolName || "Not specified"} />
            <ReportDetail label="Subject" value={subject} />
            <ReportDetail label="Topic" value={session.topic || "Not specified"} />
          </dl>
        </div>
        {top && (
          <div className="rounded-2xl border border-warning/30 bg-warning/5 px-5 py-4 text-center shrink-0">
            <div className="text-2xl">🥇</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Top scorer</div>
            <div className="font-display font-bold text-base mt-0.5 max-w-[140px] truncate">{top.name}</div>
            <div className="text-success font-bold text-sm">{top.score} pts · {top.percent}%</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold text-foreground">{value || "Not specified"}</dd>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  desc,
  color = "text-foreground",
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  desc?: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-2 hover:border-primary/30 hover:shadow-glow transition-all duration-200">
      <div className="flex items-center justify-between">
        <Icon className="h-4 w-4 text-primary/70" />
      </div>
      <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</div>}
      </div>
    </div>
  );
}

function AnswerMetric({
  label,
  value,
  tone,
  desc,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "muted";
  desc?: string;
}) {
  const color = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : "text-muted-foreground";
  const border = tone === "success" ? "border-success/20" : tone === "danger" ? "border-destructive/20" : "border-border";
  const bg = tone === "success" ? "bg-success/5" : tone === "danger" ? "bg-destructive/5" : "bg-card/50";
  return (
    <div className={`rounded-2xl border ${border} ${bg} p-4 space-y-1`}>
      <div className={`font-display text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-sm font-medium">{label}</div>
      {desc && <div className="text-[11px] text-muted-foreground leading-snug">{desc}</div>}
    </div>
  );
}

function DistributionBar({
  buckets,
  passMark,
}: {
  buckets: { top: number; pass: number; fail: number; left: number };
  passMark: number;
}) {
  const total = buckets.top + buckets.pass + buckets.fail + buckets.left;
  if (total === 0) return null;
  const pct = (n: number) => (n / total) * 100;
  const topThreshold = Math.min(100, passMark + 25);
  const bands = [
    { dot: "bg-success", label: `Excellent (>= ${topThreshold}%)`, desc: "Scored in the top band", value: buckets.top },
    { dot: "bg-primary/80", label: `Passed (${passMark}-${topThreshold - 1}%)`, desc: "Met the pass mark", value: buckets.pass },
    { dot: "bg-destructive/80", label: `Below pass (< ${passMark}%)`, desc: "Did not meet the pass mark", value: buckets.fail },
    { dot: "bg-muted-foreground/40", label: "Did not finish", desc: "Left without submitting", value: buckets.left },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
      <div className="h-4 w-full overflow-hidden rounded-full bg-muted/30 flex gap-0.5">
        {bands.map((band) => pct(band.value) > 0 && (
          <div key={band.label} className={`h-full ${band.dot} first:rounded-l-full last:rounded-r-full transition-all`}
            style={{ width: `${pct(band.value)}%` }} title={`${band.label}: ${band.value}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {bands.map((band) => (
          <div key={band.label} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${band.dot}`} />
              <span className="text-xs font-semibold">{band.value}</span>
              <span className="text-xs text-muted-foreground">({Math.round(pct(band.value))}%)</span>
            </div>
            <div className="text-[11px] font-medium pl-4 leading-tight">{band.label}</div>
            <div className="text-[10px] text-muted-foreground pl-4">{band.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
