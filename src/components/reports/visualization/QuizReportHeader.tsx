import { Trophy } from "lucide-react";
import type { QuizReportRow } from "@/lib/quiz-reports";

type VisualizationSession = {
  title: string;
  created_at: string;
  categoryName: string;
  subcategoryName: string;
  subject: string | null;
  topic: string | null;
};

type Props = {
  session: VisualizationSession;
  top: QuizReportRow | undefined;
  teacherName: string;
  schoolName: string;
};

function ReportDetail({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold text-foreground">{value || "Not specified"}</dd>
    </>
  );
}

export function QuizReportHeader({ session, top, teacherName, schoolName }: Props) {
  const category = [session.categoryName, session.subcategoryName].filter(Boolean).join(" -> ");
  const subject = session.subject || category || "Not specified";
  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card/60 to-card/40 p-6 print:border-0 print:bg-transparent print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Trophy className="size-3" /> Final Quiz Report
          </div>
          <h2 className="font-display text-2xl font-semibold leading-tight">{session.title}</h2>
          <p className="text-xs text-muted-foreground">
            Held on {new Date(session.created_at).toLocaleString()}{" "}
            {category ? `· ${category}` : ""}
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
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
              Top scorer
            </div>
            <div className="font-display font-bold text-base mt-0.5 max-w-[140px] truncate">
              {top.name}
            </div>
            <div className="text-success font-bold text-sm">
              {top.score} pts · {top.percent}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export type { VisualizationSession };
