import { ChevronLeft, PlayCircle, Trophy } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatTimePerQuestion } from "@/components/sessions/types";
import type { SessionRow } from "./types";

export function SessionHeader({
  session,
  isActive,
  isCompleted,
  paused,
  badge,
  categoryName,
  subcategoryName,
  questionCount,
  joined,
  submittedTotal,
}: {
  session: SessionRow;
  isActive: boolean;
  isCompleted: boolean;
  paused: boolean;
  badge: { label: string; className: string };
  categoryName: string;
  subcategoryName: string;
  questionCount: number;
  joined: number;
  submittedTotal: number;
}) {
  return (
    <>
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground print:hidden">
        <Link
          to="/sessions"
          className="hover:text-foreground transition-colors flex items-center gap-1"
        >
          <PlayCircle size={12} /> Sessions
        </Link>
        <ChevronLeft className="size-3 rotate-180 shrink-0" />
        <span className="text-foreground font-medium truncate max-w-[200px]">{session.title}</span>
      </nav>

      <div className="rounded-2xl border border-border bg-card/60 p-5 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${
              isActive
                ? "bg-success/15 border border-success/25 text-success"
                : isCompleted
                  ? "bg-primary/15 border border-primary/25 text-primary"
                  : "bg-muted/40 border border-border text-muted-foreground"
            }`}
          >
            {isCompleted ? <Trophy className="size-6" /> : <PlayCircle className="size-6" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-xl font-semibold tracking-tight truncate">
                {session.title}
              </h1>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.className}`}
              >
                {paused ? "Paused" : badge.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-muted-foreground">
              <span>
                {[categoryName, subcategoryName].filter(Boolean).join(" → ") || "Uncategorised"}
              </span>
              <span>·</span>
              <span>
                {questionCount} question{questionCount === 1 ? "" : "s"}
              </span>
              <span>·</span>
              <span>{formatTimePerQuestion(session.default_time_per_question ?? 60)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="text-center">
            <div className="font-display text-xl font-bold text-primary">{joined}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Joined</div>
          </div>
          {!isCompleted && (
            <div className="text-center">
              <div className="font-display text-xl font-bold text-success">{submittedTotal}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Submitted
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
