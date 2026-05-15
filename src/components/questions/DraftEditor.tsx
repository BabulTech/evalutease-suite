import { Trash2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import {
  type McqDraft,
  type Difficulty,
  MAX_QUESTION_LENGTH,
  MAX_OPTION_LENGTH,
  labelFor,
} from "./types";

// Phase 1: this editor still handles MCQ only. Future type-specific
// editors (TrueFalseEditor, ShortAnswerEditor, LongAnswerEditor)
// will live in their own files and the parent will route by draft.type.
type Props = {
  draft: McqDraft;
  index?: number;
  onChange: (next: McqDraft) => void;
  onRemove?: () => void;
  compact?: boolean;
};

export function DraftEditor({ draft, index, onChange, onRemove, compact }: Props) {
  const { t } = useI18n();
  const remaining = MAX_QUESTION_LENGTH - draft.text.length;
  const overLimit = remaining < 0;

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              {typeof index === "number" ? `${t("q.question")} ${index + 1}` : t("q.question")}
            </Label>
            <span
              className={`text-xs font-medium ${overLimit ? "text-destructive" : "text-muted-foreground"}`}
            >
              {draft.text.length}/{MAX_QUESTION_LENGTH}
            </span>
          </div>
          <Textarea
            value={draft.text}
            onChange={(e) =>
              onChange({ ...draft, text: e.target.value.slice(0, MAX_QUESTION_LENGTH) })
            }
            placeholder={t("q.typePlaceholder")}
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

      <div className="grid gap-2">
        {draft.options.map((opt, i) => {
          const isCorrect = draft.correctIndex === i;
          return (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                isCorrect ? "border-success/60 bg-success/10" : "border-border bg-background/40"
              }`}
            >
              <button
                type="button"
                onClick={() => onChange({ ...draft, correctIndex: i })}
                title={isCorrect ? t("q.correctAnswer") : t("q.markCorrect")}
                className={`shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${
                  isCorrect
                    ? "border-success bg-success text-success-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
                }`}
              >
                {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : labelFor(i)}
              </button>
              <Input
                value={opt}
                onChange={(e) => {
                  const opts = [...draft.options];
                  opts[i] = e.target.value.slice(0, MAX_OPTION_LENGTH);
                  onChange({ ...draft, options: opts });
                }}
                placeholder={`${t("q.option")} ${labelFor(i)}`}
                maxLength={MAX_OPTION_LENGTH}
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-8"
              />
            </div>
          );
        })}
      </div>

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
                onChange({ ...draft, timeSeconds: Number.isFinite(n) ? n : 10 });
              }}
              placeholder="10"
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

      <p className="text-xs text-muted-foreground">
        {t("q.tip")}
      </p>
    </div>
  );
}
