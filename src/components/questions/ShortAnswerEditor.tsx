import { useState } from "react";
import { Trash2, X, Plus, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import {
  type ShortAnswerDraft,
  type Difficulty,
  MAX_QUESTION_LENGTH,
} from "./types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  draft: ShortAnswerDraft;
  index?: number;
  onChange: (next: ShortAnswerDraft) => void;
  onRemove?: () => void;
  compact?: boolean;
};

export function ShortAnswerEditor({ draft, index, onChange, onRemove, compact }: Props) {
  const { t } = useI18n();
  const [newAnswer, setNewAnswer] = useState("");
  const remaining = MAX_QUESTION_LENGTH - draft.text.length;
  const overLimit = remaining < 0;

  // We always render at least one slot so the host has something to type into.
  const answers = draft.acceptableAnswers.length === 0 ? [""] : draft.acceptableAnswers;

  const updateAnswerAt = (i: number, value: string) => {
    const next = [...answers];
    next[i] = value;
    onChange({ ...draft, acceptableAnswers: next });
  };

  const removeAnswerAt = (i: number) => {
    const next = answers.filter((_, idx) => idx !== i);
    onChange({ ...draft, acceptableAnswers: next.length === 0 ? [""] : next });
  };

  const addAnswer = () => {
    const trimmed = newAnswer.trim();
    if (!trimmed) return;
    if (answers.some((a) => a.trim().toLowerCase() === trimmed.toLowerCase())) {
      setNewAnswer("");
      return;
    }
    onChange({
      ...draft,
      acceptableAnswers: [...answers.filter((a) => a.trim()), trimmed],
    });
    setNewAnswer("");
  };

  const hasAcceptable = answers.some((a) => a.trim());

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              {typeof index === "number" ? `${t("q.question")} ${index + 1}` : t("q.question")}
              <span className="ml-2 text-[10px] font-bold text-primary">· SHORT ANSWER</span>
            </Label>
            <span className={`text-xs font-medium ${overLimit ? "text-destructive" : "text-muted-foreground"}`}>
              {draft.text.length}/{MAX_QUESTION_LENGTH}
            </span>
          </div>
          <Textarea
            value={draft.text}
            onChange={(e) =>
              onChange({ ...draft, text: e.target.value.slice(0, MAX_QUESTION_LENGTH) })
            }
            placeholder="Ask a short-answer question, e.g. 'What is the capital of Pakistan?'"
            maxLength={MAX_QUESTION_LENGTH}
            className="min-h-[64px] resize-none"
          />
        </div>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Manual grading toggle */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
        <div>
          <div className="text-sm font-medium">Grade manually (or with AI)</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {draft.requiresManualGrading
              ? "You'll review each student's answer after the quiz ends."
              : "Auto-grade by matching against the accepted answers below."}
          </p>
        </div>
        <Switch
          checked={draft.requiresManualGrading}
          onCheckedChange={(v) => onChange({ ...draft, requiresManualGrading: v })}
        />
      </div>

      {/* Accepted answers (auto-grade only) */}
      {!draft.requiresManualGrading && (
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Accepted Answers
            <span className="ml-2 normal-case text-muted-foreground/70 font-normal">
              (case-insensitive, exact text match)
            </span>
          </Label>
          <div className="space-y-1.5">
            {answers.map((ans, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2"
              >
                <Input
                  value={ans}
                  onChange={(e) => updateAnswerAt(i, e.target.value)}
                  placeholder={i === 0 ? "e.g. Islamabad" : "Another accepted answer"}
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-8"
                />
                {answers.length > 1 && (
                  <button
                    type="button"
                    title="Remove this answer"
                    onClick={() => removeAnswerAt(i)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAnswer();
                }
              }}
              placeholder="Add another accepted answer…"
              className="h-9"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addAnswer}
              disabled={!newAnswer.trim()}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          {!hasAcceptable && (
            <div className="flex items-start gap-1.5 text-[11px] text-warning">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Add at least one accepted answer, or enable manual grading above.
              </span>
            </div>
          )}
        </div>
      )}

      {!compact && (
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              {t("q.difficulty")}
            </Label>
            <Select
              value={draft.difficulty}
              onValueChange={(v) => onChange({ ...draft, difficulty: v as Difficulty })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">{t("q.easy")}</SelectItem>
                <SelectItem value="medium">{t("q.medium")}</SelectItem>
                <SelectItem value="hard">{t("q.hard")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              {t("q.timeSec")}
            </Label>
            <Input
              type="number"
              min={5}
              max={3600}
              value={draft.timeSeconds}
              onChange={(e) => {
                const n = Number(e.target.value);
                onChange({ ...draft, timeSeconds: Number.isFinite(n) ? n : 30 });
              }}
              placeholder="30"
            />
          </div>
          <div>
            <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              {t("q.explanation")}
            </Label>
            <Input
              value={draft.explanation}
              onChange={(e) => onChange({ ...draft, explanation: e.target.value })}
              placeholder={t("q.explanationPlaceholder")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
