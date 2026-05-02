import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, CheckCircle2, Sparkles, ScanLine, Upload, FileEdit } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { DraftEditor } from "./DraftEditor";
import {
  validateDraft,
  type DraftQuestion,
  type Question,
  type QuestionSource,
  labelFor,
} from "./types";

const SOURCE_META: Record<QuestionSource, { label: string; icon: typeof Pencil }> = {
  manual: { label: "Manual", icon: FileEdit },
  ai: { label: "AI", icon: Sparkles },
  ocr: { label: "Scan", icon: ScanLine },
  import: { label: "Import", icon: Upload },
};

type Props = {
  questions: Question[];
  loading: boolean;
  onUpdate: (id: string, draft: DraftQuestion) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function QuestionList({ questions, loading, onUpdate, onDelete }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
        Loading questions…
      </div>
    );
  }
  if (questions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center">
        <p className="text-sm font-medium">No questions yet in this category</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Use the tabs above to add them manually, scan an image, generate with AI, or upload a
          file.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {questions.map((q) => (
        <li key={q.id}>
          <QuestionCard q={q} onUpdate={onUpdate} onDelete={onDelete} />
        </li>
      ))}
    </ul>
  );
}

function QuestionCard({
  q,
  onUpdate,
  onDelete,
}: {
  q: Question;
  onUpdate: Props["onUpdate"];
  onDelete: Props["onDelete"];
}) {
  const SrcIcon = SOURCE_META[q.source].icon;
  const correctIdx = q.options.findIndex((o) => o === q.correct_answer);

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              q.difficulty === "easy"
                ? "bg-success/15 text-success"
                : q.difficulty === "hard"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-primary/15 text-primary"
            }`}
          >
            {q.difficulty}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <SrcIcon className="h-3 w-3" /> {SOURCE_META[q.source].label}
          </span>
        </div>
        <div className="flex gap-1">
          <EditQuestionDialog q={q} onSave={onUpdate} />
          <DeleteQuestionButton q={q} onConfirm={onDelete} />
        </div>
      </div>
      <p className="text-sm font-medium leading-relaxed">{q.text}</p>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {q.options.map((opt, i) => {
          const isCorrect = i === correctIdx;
          return (
            <li
              key={i}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                isCorrect
                  ? "border-success/50 bg-success/10 text-foreground"
                  : "border-border bg-background/30 text-muted-foreground"
              }`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  isCorrect
                    ? "bg-success text-success-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isCorrect ? <CheckCircle2 className="h-3 w-3" /> : labelFor(i)}
              </span>
              <span className="truncate">{opt}</span>
            </li>
          );
        })}
      </ul>
      {q.explanation && (
        <p className="mt-3 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Explanation: </span>
          {q.explanation}
        </p>
      )}
    </div>
  );
}

function EditQuestionDialog({ q, onSave }: { q: Question; onSave: Props["onUpdate"] }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftQuestion>(() => questionToDraft(q));
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const v = validateDraft(draft);
    if (!v.ok) {
      toast.error(v.reason);
      return;
    }
    setBusy(true);
    try {
      await onSave(q.id, draft);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(questionToDraft(q));
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit question</DialogTitle>
        </DialogHeader>
        <DraftEditor draft={draft} onChange={setDraft} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteQuestionButton({ q, onConfirm }: { q: Question; onConfirm: Props["onDelete"] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete question?</AlertDialogTitle>
          <AlertDialogDescription>
            "{q.text.length > 80 ? q.text.slice(0, 80) + "…" : q.text}" will be permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await onConfirm(q.id);
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function questionToDraft(q: Question): DraftQuestion {
  const options = [...q.options];
  while (options.length < 4) options.push("");
  const correctIndex = Math.max(
    0,
    options.findIndex((o) => o === q.correct_answer),
  );
  return {
    text: q.text,
    options: options.slice(0, 4),
    correctIndex: correctIndex === -1 ? 0 : correctIndex,
    difficulty: q.difficulty,
    explanation: q.explanation ?? "",
  };
}
