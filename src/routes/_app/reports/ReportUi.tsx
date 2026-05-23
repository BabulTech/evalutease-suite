import React from "react";
import { Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function SectionLabel({ title, desc }: { title: string; desc: string }) {
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

export function FilterField({
  icon: Icon,
  label,
  hint,
  children,
}: {
  icon: typeof Users;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
        <Icon className="size-3.5 text-primary/70" /> {label}
      </div>
      {hint && <p className="text-[10px] text-muted-foreground -mt-0.5 pl-5">{hint}</p>}
      {children}
    </div>
  );
}

export function Metric({
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
        <Icon className="size-4 text-primary/70" />
      </div>
      <div className={`font-display text-2xl font-bold ${color}`}>{value}</div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        {desc && (
          <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{desc}</div>
        )}
      </div>
    </div>
  );
}

export function ReportDetail({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold text-foreground">{value || t("rep.notSpecified")}</p>
    </div>
  );
}

export function ResultBadge({
  row,
  passMark,
}: {
  row: import("@/lib/quiz-reports").QuizReportRow;
  passMark: number;
}) {
  const { t } = useI18n();
  if (!row.completed) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {t("rep.resultLeft")}
      </span>
    );
  }
  const passed = row.percent >= passMark;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        passed
          ? "bg-success/15 text-success border border-success/30"
          : "bg-destructive/15 text-destructive border border-destructive/30"
      }`}
    >
      {passed ? t("rep.resultPass") : t("rep.resultFail")}
    </span>
  );
}

export function AnswerCard({ a, i }: { a: import("./types").AttemptAnswer; i: number }) {
  const isPending =
    !a.graded_at && (a.question_type === "short_answer" || a.question_type === "long_answer");
  const typeLabel =
    a.question_type === "mcq"
      ? "MCQ"
      : a.question_type === "true_false"
        ? "T/F"
        : a.question_type === "short_answer"
          ? "Short"
          : "Long";
  const pts = a.points_awarded;
  const pointColor = isPending
    ? "text-warning"
    : pts === a.max_points
      ? "text-success"
      : pts === 0
        ? "text-destructive"
        : "text-warning";

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3 space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <span className="shrink-0 text-[10px] font-bold uppercase rounded bg-muted/60 px-1.5 py-0.5 text-muted-foreground mt-0.5">
            {typeLabel}
          </span>
          <p className="text-sm font-medium text-foreground leading-snug">
            <span className="text-muted-foreground mr-1">Q{i + 1}.</span>
            {a.question_text}
          </p>
        </div>
        <div className={`shrink-0 text-sm font-bold ${pointColor}`}>
          {isPending ? (
            <span className="text-warning text-xs font-medium">Pending</span>
          ) : (
            <>
              {pts ?? 0}
              <span className="text-xs text-muted-foreground font-normal">/{a.max_points}</span>
            </>
          )}
        </div>
      </div>
      <div className="ml-[2.25rem]">
        {a.answer ? (
          <p
            className={`text-xs rounded-lg px-3 py-2 border ${
              isPending
                ? "bg-muted/20 border-border text-foreground"
                : (pts ?? 0) === a.max_points
                  ? "bg-success/5 border-success/20 text-success"
                  : (pts ?? 0) === 0
                    ? "bg-destructive/5 border-destructive/20 text-destructive"
                    : "bg-warning/5 border-warning/20 text-warning"
            }`}
          >
            {a.answer}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground italic">No answer submitted</p>
        )}
      </div>
    </div>
  );
}
