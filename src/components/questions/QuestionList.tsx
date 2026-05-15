import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Pencil, Trash2, CheckCircle2, Sparkles, ScanLine, Upload, FileEdit, Timer,
  ChevronDown, ChevronUp, Filter, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DraftEditorRouter } from "./DraftEditorRouter";
import { validateDraft, type DraftQuestion, type Question, type QuestionSource, labelFor } from "./types";

const SOURCE_META: Record<QuestionSource, { label: string; icon: typeof Pencil }> = {
  manual: { label: "Manual", icon: FileEdit },
  ai:     { label: "AI",     icon: Sparkles },
  ocr:    { label: "Scan",   icon: ScanLine },
  import: { label: "Import", icon: Upload },
};

const DIFFICULTY_OPTS = ["all", "easy", "medium", "hard"] as const;
type DifficultyFilter = (typeof DIFFICULTY_OPTS)[number];

type Props = {
  questions: Question[];
  loading: boolean;
  onUpdate: (id: string, draft: DraftQuestion) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  usageCounts?: Map<string, number>;
  lastUsed?: Map<string, string>;
};

export function QuestionList({ questions, loading, onUpdate, onDelete, usageCounts, lastUsed }: Props) {
  const [diffFilter, setDiffFilter] = useState<DifficultyFilter>("all");
  const [searchFilter, setSearchFilter] = useState("");

  const filtered = useMemo(() => {
    let qs = questions;
    if (diffFilter !== "all") qs = qs.filter((q) => q.difficulty === diffFilter);
    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      qs = qs.filter((q) => q.text.toLowerCase().includes(term));
    }
    return qs;
  }, [questions, diffFilter, searchFilter]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground animate-pulse">
        Loading questions…
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center">
        <p className="text-sm font-medium">No questions yet in this topic</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Use the tabs above to add them manually, scan an image, generate with AI, or upload a file.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Filter bar — chips, all visible (Hick's Law) ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <Filter size={13} /> Filter:
        </div>
        {DIFFICULTY_OPTS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDiffFilter(d)}
            className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-medium border transition-all capitalize ${
              diffFilter === d
                ? d === "easy"   ? "bg-success/20 border-success/50 text-success"
                : d === "hard"   ? "bg-destructive/20 border-destructive/50 text-destructive"
                : d === "medium" ? "bg-primary/20 border-primary/50 text-primary"
                :                  "bg-primary text-primary-foreground border-primary"
                : "bg-card/60 border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {d === "all" ? `All (${questions.length})` : `${d} (${questions.filter((q) => q.difficulty === d).length})`}
          </button>
        ))}
        {diffFilter !== "all" && (
          <button
            type="button"
            onClick={() => setDiffFilter("all")}
            aria-label="Clear filter"
            className="min-h-[32px] px-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all"
          >
            <X size={12} />
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {questions.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/30 p-6 text-center text-sm text-muted-foreground">
          No questions match the current filter.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((q, idx) => (
            <li key={q.id}>
              <QuestionCard
                q={q}
                index={idx + 1}
                onUpdate={onUpdate}
                onDelete={onDelete}
                usageCount={usageCounts?.get(q.id) ?? 0}
                lastUsedAt={lastUsed?.get(q.id) ?? null}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuestionCard({
  q, index, onUpdate, onDelete, usageCount, lastUsedAt,
}: {
  q: Question;
  index: number;
  onUpdate: Props["onUpdate"];
  onDelete: Props["onDelete"];
  usageCount: number;
  lastUsedAt: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const SrcIcon = SOURCE_META[q.source ?? "manual"].icon;
  const correctIdx = q.options.findIndex((o) => o === q.correct_answer);
  const hasOptions = q.options.length > 0;

  return (
    <div className={`rounded-2xl border bg-card/60 transition-all ${expanded ? "border-primary/30" : "border-border hover:border-primary/20"}`}>
      {/* ── Collapsed header — always visible ── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3 flex items-start gap-3 min-h-[56px]"
        aria-expanded={expanded ? "true" : "false"}
      >
        {/* Index number */}
        <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
          {index}
        </span>

        {/* Question text — clamped to 2 lines when collapsed */}
        <span className={`flex-1 min-w-0 text-sm font-medium leading-snug ${expanded ? "" : "line-clamp-2"}`}>
          {q.text}
        </span>

        {/* Right side badges + expand toggle */}
        <div className="flex items-center gap-2 shrink-0 ml-1">
          <span className={`hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            q.difficulty === "easy"   ? "bg-success/15 text-success"
            : q.difficulty === "hard" ? "bg-destructive/15 text-destructive"
            :                           "bg-primary/15 text-primary"
          }`}>
            {q.difficulty}
          </span>
          {hasOptions && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              {q.options.length} opts
            </span>
          )}
          {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </button>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
          {/* Tags row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              q.difficulty === "easy"   ? "bg-success/15 text-success"
              : q.difficulty === "hard" ? "bg-destructive/15 text-destructive"
              :                           "bg-primary/15 text-primary"
            }`}>
              {q.difficulty}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <SrcIcon className="h-3 w-3" /> {SOURCE_META[q.source ?? "manual"].label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Timer className="h-3 w-3" /> {q.time_seconds}s
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              usageCount === 0 ? "bg-muted/50 text-muted-foreground" : "bg-primary/10 text-primary"
            }`}>
              Used {usageCount}×{lastUsedAt ? ` · ${new Date(lastUsedAt).toLocaleDateString()}` : ""}
            </span>

            {/* Action buttons inline with tags (Fitts' Law — close to content) */}
            <div className="ml-auto flex gap-1">
              <EditQuestionDialog q={q} onSave={onUpdate} />
              <DeleteQuestionButton q={q} onConfirm={onDelete} />
            </div>
          </div>

          {/* Options — each in a full-width row, no truncation, no overflow */}
          {hasOptions && (
            <ul className="space-y-1.5">
              {q.options.map((opt, i) => {
                const isCorrect = i === correctIdx;
                return (
                  <li
                    key={i}
                    className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                      isCorrect
                        ? "border-success/50 bg-success/10 text-foreground"
                        : "border-border bg-background/30 text-muted-foreground"
                    }`}
                  >
                    <span className={`shrink-0 mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                      isCorrect ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {isCorrect ? <CheckCircle2 className="h-3 w-3" /> : labelFor(i)}
                    </span>
                    {/* No truncate — full text, wraps naturally */}
                    <span className="break-words min-w-0">{opt}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Model answer for non-MCQ */}
          {!hasOptions && q.correct_answer && (
            <div className="rounded-xl border border-success/30 bg-success/5 px-3 py-2 text-sm">
              <span className="text-xs font-semibold text-success block mb-1">Correct Answer</span>
              <span className="text-foreground break-words">{q.correct_answer}</span>
            </div>
          )}

          {q.explanation && (
            <div className="rounded-xl bg-muted/30 px-3 py-2 text-xs text-muted-foreground break-words">
              <span className="font-semibold text-foreground">Explanation: </span>
              {q.explanation}
            </div>
          )}
        </div>
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
    if (!v.ok) { toast.error(v.reason); return; }
    setBusy(true);
    try { await onSave(q.id, draft); setOpen(false); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft(questionToDraft(q)); }}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        title="Edit question"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <DialogContent
        className="max-w-2xl w-full flex flex-col"
        style={{ maxHeight: "90dvh" }}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>Edit question</DialogTitle>
        </DialogHeader>
        {/* Scrollable editor area — prevents dialog overflow */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          <DraftEditorRouter draft={draft} onChange={setDraft} />
        </div>
        <DialogFooter className="shrink-0 pt-3 border-t border-border">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-gradient-primary text-primary-foreground shadow-glow">
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
        title="Delete question"
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
              try { await onConfirm(q.id); setOpen(false); }
              finally { setBusy(false); }
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
  const correctIndex = Math.max(0, options.findIndex((o) => o === q.correct_answer));
  return {
    type: "mcq",
    text: q.text,
    options: options.slice(0, 4),
    correctIndex: correctIndex === -1 ? 0 : correctIndex,
    difficulty: q.difficulty,
    explanation: q.explanation ?? "",
    timeSeconds: q.time_seconds,
    maxPoints: q.max_points ?? 1,
  };
}
