import { useState, type ReactNode } from "react";
import { PlayCircle, Pencil, Trash2, Crown, ListTree, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatTimePerQuestion, statusBadge, type Session } from "./types";

type Props = {
  session: Session;
  onStart: (id: string) => Promise<void>;
  onOpenLobby: (session: Session) => void;
  editTrigger: ReactNode;
  onDelete: (id: string) => Promise<void>;
};

export function SessionCard({ session, onStart, onOpenLobby, editTrigger, onDelete }: Props) {
  const badge = statusBadge(session);
  const { joined, waiting, submitted, avgPercent, topThree } = session.attempts;
  const canStartFromCard = session.status !== "completed" && session.status !== "expired";

  const [starting, setStarting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      await onStart(session.id);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 transition-colors hover:border-primary/30 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold truncate">{session.title}</h3>
          <div className="mt-1 text-xs text-muted-foreground flex items-center flex-wrap gap-x-2 gap-y-0.5">
            <span className="inline-flex items-center gap-1">
              <ListTree className="h-3 w-3" />
              {session.category_name ?? "Uncategorised"}
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
                  <Calendar className="h-3 w-3" />
                  {new Date(session.scheduled_at).toLocaleString()}
                </span>
              </>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <CounterPill value={joined} label="joined" tone="primary" />
        <Divider />
        <CounterPill value={waiting} label="waiting" tone="success" />
        <Divider />
        <CounterPill value={submitted} label="submitted" tone="success" />
        <Divider />
        <CounterPill
          value={`${avgPercent}%`}
          label="avg"
          tone={avgPercent >= 70 ? "success" : avgPercent >= 40 ? "primary" : "muted"}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => {
          const t = topThree[i];
          return (
            <div key={i} className="rounded-xl border border-border bg-card/40 p-3 min-h-[88px]">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                <Crown className="h-3 w-3 text-warning" /> Top {i + 1}
              </div>
              {t ? (
                <>
                  <div className="mt-2 text-sm font-semibold truncate">{t.name}</div>
                  <div className="text-xs text-success font-bold">
                    {t.score}/{t.total}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-2 text-sm font-semibold text-muted-foreground">Waiting…</div>
                  <div className="text-xs text-muted-foreground">No result yet</div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={handleStart}
          disabled={!canStartFromCard || starting}
          className="bg-gradient-primary text-primary-foreground shadow-glow"
        >
          <PlayCircle className="h-4 w-4 mr-1" />
          {session.status === "active" ? "Resume" : starting ? "Starting…" : "Start Live Quiz"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onOpenLobby(session)}>
          Open Lobby
        </Button>
        {editTrigger}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirmDelete(true)}
          className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-1" /> Delete
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{session.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The session, its question list, attempts, and answers will all be removed. This can't
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={async (e) => {
                e.preventDefault();
                setDeleting(true);
                try {
                  await onDelete(session.id);
                  setConfirmDelete(false);
                } finally {
                  setDeleting(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CounterPill({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  tone: "primary" | "success" | "muted";
}) {
  const color =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-success"
        : "text-muted-foreground";
  return (
    <div className="flex items-baseline gap-1">
      <span className={`font-bold ${color}`}>{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function Divider() {
  return <span className="text-muted-foreground/50">|</span>;
}

export function EditTriggerButton() {
  return (
    <Button size="sm" variant="outline">
      <Pencil className="h-4 w-4 mr-1" /> Edit Quiz
    </Button>
  );
}
