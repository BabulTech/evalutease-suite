import { useState } from "react";
import { Trash2, X, Plus, AlertCircle, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
    onChange({ ...draft, acceptableAnswers: [...answers.filter((a) => a.trim()), trimmed] });
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
            onChange={(e) => onChange({ ...draft, text: e.target.value.slice(0, MAX_QUESTION_LENGTH) })}
            placeholder="Ask a short-answer question, e.g. 'What is the capital of Pakistan?'"
            maxLength={MAX_QUESTION_LENGTH}
            className="min-h-[64px] resize-none"
          />
        </div>
        {onRemove && (
          <Button type="button" variant="ghost" size="icon" onClick={onRemove}
            className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Accepted answers for auto-matching */}
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Accepted Answers
          <span className="ml-2 normal-case text-muted-foreground/70 font-normal">
            (optional — used for auto-matching. You can also grade manually or with AI after the quiz.)
          </span>
        </Label>
        <div className="space-y-1.5">
          {answers.map((ans, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2">
              <Input
                value={ans}
                onChange={(e) => updateAnswerAt(i, e.target.value)}
                placeholder={i === 0 ? "e.g. Islamabad" : "Another accepted answer"}
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-8"
              />
              {answers.length > 1 && (
                <button type="button" title="Remove answer" onClick={() => removeAnswerAt(i)}
                  className="text-muted-foreground hover:text-destructive">
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
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAnswer(); } }}
            placeholder="Add another accepted answer…"
            className="h-9"
          />
          <Button type="button" variant="outline" size="sm" onClick={addAnswer}
            disabled={!newAnswer.trim()} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
        {!hasAcceptable && (
          <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" />
            <span>No accepted answers set — grading will need to be done manually or with AI after the quiz.</span>
          </div>
        )}
      </div>

      {!compact && (
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              {t("q.difficulty")}
            </Label>
            <Select value={draft.difficulty}
              onValueChange={(v) => onChange({ ...draft, difficulty: v as Difficulty })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">{t("q.easy")}</SelectItem>
                <SelectItem value="medium">{t("q.medium")}</SelectItem>
                <SelectItem value="hard">{t("q.hard")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Time Limit
            </Label>
            <div className="flex items-center gap-1.5">
              <Select
                value={String(Math.floor(draft.timeSeconds / 60))}
                onValueChange={(v) => onChange({ ...draft, timeSeconds: Number(v) * 60 + (draft.timeSeconds % 60) })}
              >
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0,1,2,3,4,5,10,15,20,30].map((m) => (
                    <SelectItem key={m} value={String(m)}>{m}m</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(draft.timeSeconds % 60)}
                onValueChange={(v) => onChange({ ...draft, timeSeconds: Math.floor(draft.timeSeconds / 60) * 60 + Number(v) })}
              >
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0,15,30,45].map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}s</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">= {draft.timeSeconds}s total</p>
          </div>
          <div>
            <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              Max Points
            </Label>
            <Input type="number" min={1} max={100} value={draft.maxPoints}
              onChange={(e) => {
                const n = Number(e.target.value);
                onChange({ ...draft, maxPoints: Number.isFinite(n) && n >= 1 ? Math.min(n, 100) : 1 });
              }} placeholder="1" />
          </div>
          <div>
            <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              {t("q.explanation")}
            </Label>
            <Input value={draft.explanation}
              onChange={(e) => onChange({ ...draft, explanation: e.target.value })}
              placeholder={t("q.explanationPlaceholder")} />
          </div>
        </div>
      )}
    </div>
  );
}
