import React from "react";
import { BarChart3, CheckCircle2, Star, Trophy, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { SessionStat } from "./types";

function scoreColor(pct: number) {
  if (pct >= 70) return "text-success";
  if (pct >= 40) return "text-warning";
  return "text-destructive";
}

function barColor(pct: number) {
  if (pct >= 70) return "bg-success";
  if (pct >= 40) return "bg-warning";
  return "bg-destructive";
}

export function PerformanceTab({ stats }: { stats: SessionStat[] }) {
  const { t } = useI18n();
  if (stats.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
        <BarChart3 className="mx-auto size-10 text-muted-foreground/60" />
        <p className="mt-3 text-sm font-medium">{t("rev.noSessions")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("rev.noSessionsHint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {stats.map((s) => (
        <div
          key={s.id}
          className="rounded-2xl border border-border bg-card/60 p-5 hover:border-primary/30 hover:shadow-glow transition-all"
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="font-semibold truncate">{s.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {new Date(s.created_at).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {" · "}
                {s.participant_count} participant{s.participant_count !== 1 ? "s" : ""}
              </div>
            </div>
            {s.avg_rating !== null && (
              <div className="flex items-center gap-1 shrink-0 rounded-full bg-warning/10 border border-warning/25 px-2.5 py-1 text-xs font-semibold text-warning">
                <Star className="size-3 fill-warning" />
                {s.avg_rating}/5
                <span className="text-warning/60 font-normal">({s.review_count})</span>
              </div>
            )}
          </div>

          {s.participant_count > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl bg-secondary/40 px-3 py-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    {t("rev.avgScore")}
                  </div>
                  <div className={`text-xl font-bold ${scoreColor(s.avg_pct)}`}>{s.avg_pct}%</div>
                </div>
                <div className="rounded-xl bg-secondary/40 px-3 py-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-center gap-1">
                    <Trophy className="size-3 text-warning" /> {t("rev.highest")}
                  </div>
                  <div className="text-xl font-bold text-warning">{s.highest_pct}%</div>
                </div>
                <div className="rounded-xl bg-secondary/40 px-3 py-2.5 text-center">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    {t("rev.lowest")}
                  </div>
                  <div className={`text-xl font-bold ${scoreColor(s.lowest_pct)}`}>
                    {s.lowest_pct}%
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="size-3.5" />
                  <span className="font-semibold">{s.total_correct}</span> {t("rev.correct")}
                </div>
                <div className="flex items-center gap-1.5 text-destructive">
                  <XCircle className="size-3.5" />
                  <span className="font-semibold">{s.total_wrong}</span> {t("rev.wrong")}
                </div>
                {s.total_unattempted > 0 && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="font-semibold">{s.total_unattempted}</span> {t("rev.skipped")}
                  </div>
                )}
              </div>
              <div className="mt-3">
                <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={`pct-bar h-full rounded-full transition-all ${barColor(s.avg_pct)}`}
                    style={{ "--pct": `${s.avg_pct}%` } as React.CSSProperties}
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{t("rev.noParticipants")}</p>
          )}
        </div>
      ))}
    </div>
  );
}
