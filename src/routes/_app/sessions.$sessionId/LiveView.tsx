import { lazy, Suspense } from "react";
import { PenLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/PaginationControls";
import type { LeaderboardEntry } from "@/components/sessions/Leaderboard";
import type { Attendee } from "./types";
import { PARTICIPANT_PAGE_SIZES } from "./types";
import { JoinPanel, StatTile } from "./JoinPanel";

const Leaderboard = lazy(() =>
  import("@/components/sessions/Leaderboard").then((m) => ({ default: m.Leaderboard })),
);

export function LeaderboardLoading() {
  return (
    <div className="rounded-xl border border-border bg-card/30 p-5 text-sm text-muted-foreground">
      Loading leaderboard…
    </div>
  );
}

export function LiveView({
  attendees,
  joinUrl,
  accessCode,
  onCopy,
  paused,
  joinedTotal,
  submittedTotal,
  query,
  onQueryChange,
  sort,
  onSortChange,
  page,
  total,
  onPageChange,
  pageSize,
  onPageSizeChange,
  hasTypedQuestions,
}: {
  attendees: Attendee[];
  joinUrl: string;
  accessCode: string;
  onCopy: (text: string, label: string) => Promise<void>;
  paused: boolean;
  joinedTotal: number;
  submittedTotal: number;
  query: string;
  onQueryChange: (value: string) => void;
  sort: "score" | "completed_at" | "started_at";
  onSortChange: (value: "score" | "completed_at" | "started_at") => void;
  page: number;
  total: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
  hasTypedQuestions: boolean;
}) {
  const entries: LeaderboardEntry[] = attendees.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    rollNumber: a.rollNumber,
    score: a.score,
    total: a.total,
    completed: a.completed,
  }));
  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <JoinPanel
        joinUrl={joinUrl}
        accessCode={accessCode}
        onCopy={onCopy}
        size={148}
        // react-doctor-disable-next-line react-doctor/jsx-no-jsx-as-prop
        statTiles={
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Joined" value={joinedTotal} tone="primary" />
            <StatTile label="Submitted" value={submittedTotal} tone="success" />
          </div>
        }
      />
      <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Live leaderboard
            </div>
            <h2 className="font-display text-xl font-semibold">
              {paused ? "Quiz paused" : "Quiz in progress"}
            </h2>
          </div>
          {!paused && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 text-success px-3 py-1 text-xs font-bold">
              <span className="inline-block size-2 rounded-full bg-success animate-pulse" /> LIVE
            </span>
          )}
        </div>
        {hasTypedQuestions && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5 text-xs text-warning flex items-start gap-2">
            <PenLine className="size-3.5 mt-0.5 shrink-0" />
            <span>
              Live scores include only MCQ &amp; True/False answers. Short and long answers are
              added after manual/AI grading at the end of the quiz.
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[200px] flex-1">
            <Input
              placeholder="Search participants..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {(
              [
                ["score", "Score"],
                ["completed_at", "Fastest"],
                ["started_at", "Join order"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => onSortChange(val)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px] ${
                  sort === val
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <Suspense fallback={<LeaderboardLoading />}>
          <Leaderboard entries={entries} mode="live" />
        </Suspense>
        <PaginationControls
          page={page}
          pageSize={pageSize}
          total={total}
          label="participants"
          onPageChange={onPageChange}
          pageSizeOptions={PARTICIPANT_PAGE_SIZES}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  );
}
