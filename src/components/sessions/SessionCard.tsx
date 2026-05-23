import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Calendar, ListTree, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTimePerQuestion, statusBadge, type Session } from "./types";
import { AttemptStats } from "./session-card/AttemptStats";
import { TopThreePodium } from "./session-card/TopThreePodium";
import { DeleteSessionDialog } from "./session-card/DeleteSessionDialog";

type Props = {
  session: Session;
  onDelete: (id: string) => Promise<void>;
};

export function SessionCard({ session, onDelete }: Props) {
  const badge = statusBadge(session);
  const { joined, waiting, submitted, avgPercent, topThree } = session.attempts;
  const isActive = session.status === "active";
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 transition-colors hover:border-primary/30 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <Link
          to="/sessions/$sessionId"
          params={{ sessionId: session.id }}
          className="min-w-0 flex-1 group"
        >
          <h3 className="font-display text-lg font-semibold truncate group-hover:text-primary transition-colors">
            {session.title}
          </h3>
          <div className="mt-1 text-xs text-muted-foreground flex items-center flex-wrap gap-x-2 gap-y-0.5">
            <span className="inline-flex items-center gap-1">
              <ListTree className="size-3" /> {session.category_name ?? "Uncategorised"}
            </span>
            <span>·</span>
            <span>
              {session.question_count} question{session.question_count === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span>{formatTimePerQuestion(session.default_time_per_question)}</span>
            {session.scheduled_at && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3" /> {new Date(session.scheduled_at).toLocaleString()}
                </span>
              </>
            )}
          </div>
        </Link>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      <AttemptStats
        joined={joined}
        waiting={waiting}
        submitted={submitted}
        avgPercent={avgPercent}
      />
      <TopThreePodium topThree={topThree} />

      <div className="flex items-center gap-2 pt-1">
        <Button
          asChild
          size="sm"
          className="bg-gradient-primary text-primary-foreground shadow-glow gap-1.5"
        >
          <Link to="/sessions/$sessionId" params={{ sessionId: session.id }}>
            Open Lobby <ArrowRight className="size-3.5" />
          </Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirmDelete(true)}
          disabled={isActive}
          title={isActive ? "Quiz is locked while participants are playing" : undefined}
          className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4 mr-1" /> Delete
        </Button>
      </div>

      <DeleteSessionDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={session.title}
        isActive={isActive}
        onConfirm={() => onDelete(session.id)}
      />
    </div>
  );
}
