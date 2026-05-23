import { useState } from "react";
import {
  Pencil,
  CheckCircle2,
  Sparkles,
  ScanLine,
  Upload,
  FileEdit,
  Timer,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Question, QuestionSource } from "../types";
import { labelFor } from "../types";
import { EditQuestionDialog } from "./EditQuestionDialog";
import { DeleteQuestionButton } from "./DeleteQuestionButton";
import type { DraftQuestion } from "../types";

const SOURCE_META: Record<QuestionSource, { label: string; icon: typeof Pencil }> = {
  manual: { label: "Manual", icon: FileEdit },
  ai: { label: "AI", icon: Sparkles },
  ocr: { label: "Scan", icon: ScanLine },
  import: { label: "Import", icon: Upload },
};

type Props = {
  q: Question;
  index: number;
  onUpdate: (id: string, draft: DraftQuestion) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  usageCount: number;
  lastUsedAt: string | null;
};

export function QuestionCard({ q, index, onUpdate, onDelete, usageCount, lastUsedAt }: Props) {
  const [expanded, setExpanded] = useState(false);
  const SrcIcon = SOURCE_META[q.source ?? "manual"].icon;
  const correctIdx = q.options.findIndex((o) => o === q.correct_answer);
  const hasOptions = q.options.length > 0;

  return (
    <div
      className={`rounded-2xl border bg-card/60 transition-all ${expanded ? "border-primary/30" : "border-border hover:border-primary/20"}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3 flex items-start gap-3 min-h-[56px]"
        aria-expanded={expanded ? "true" : "false"}
      >
        <span className="shrink-0 mt-0.5 size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
          {index}
        </span>
        <span
          className={`flex-1 min-w-0 text-sm font-medium leading-snug ${expanded ? "" : "line-clamp-2"}`}
        >
          {q.text}
        </span>
        <div className="flex items-center gap-2 shrink-0 ml-1">
          <span
            className={`hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              q.difficulty === "easy"
                ? "bg-success/15 text-success"
                : q.difficulty === "hard"
                  ? "bg-destructive/15 text-destructive"
                  : "bg-primary/15 text-primary"
            }`}
          >
            {q.difficulty}
          </span>
          {hasOptions && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              {q.options.length} opts
            </span>
          )}
          {expanded ? (
            <ChevronUp size={14} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={14} className="text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
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
              <SrcIcon className="size-3" /> {SOURCE_META[q.source ?? "manual"].label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <Timer className="size-3" /> {q.time_seconds}s
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                usageCount === 0
                  ? "bg-muted/50 text-muted-foreground"
                  : "bg-primary/10 text-primary"
              }`}
            >
              Used {usageCount}×
              {lastUsedAt ? ` · ${new Date(lastUsedAt).toLocaleDateString()}` : ""}
            </span>
            <div className="ml-auto flex gap-1">
              <EditQuestionDialog q={q} onSave={onUpdate} />
              <DeleteQuestionButton q={q} onConfirm={onDelete} />
            </div>
          </div>

          {hasOptions && (
            <ul className="space-y-1.5">
              {q.options.map((opt, i) => {
                const isCorrect = i === correctIdx;
                return (
                  <li
                    key={`${i}-${opt}`}
                    className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                      isCorrect
                        ? "border-success/50 bg-success/10 text-foreground"
                        : "border-border bg-background/30 text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`shrink-0 mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        isCorrect
                          ? "bg-success text-success-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isCorrect ? <CheckCircle2 className="size-3" /> : labelFor(i)}
                    </span>
                    <span className="break-words min-w-0">{opt}</span>
                  </li>
                );
              })}
            </ul>
          )}

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
