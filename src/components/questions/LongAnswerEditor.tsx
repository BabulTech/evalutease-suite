import { Trash2, BookOpen, ListChecks } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { type LongAnswerDraft, type Difficulty, MAX_QUESTION_LENGTH } from "./types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  draft: LongAnswerDraft;
  index?: number;
  onChange: (next: LongAnswerDraft) => void;
  onRemove?: () => void;
  compact?: boolean;
};

export function LongAnswerEditor({ draft, index, onChange, onRemove, compact }: Props) {
  const { t } = useI18n();
  const remaining = MAX_QUESTION_LENGTH - draft.text.length;
  const overLimit = remaining < 0;

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
      {/* Question stem */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              {typeof index === "number" ? `${t("q.question")} ${index + 1}` : t("q.question")}
              <span className="ml-2 text-[10px] font-bold text-primary">· LONG ANSWER</span>
            </Label>
            <span className={`text-xs font-medium ${overLimit ? "text-destructive" : "text-muted-foreground"}`}>
              {draft.text.length}/{MAX_QUESTION_LENGTH}
            </span>
          </div>
          <Textarea
            value={draft.text}
            onChange={(e) => onChange({ ...draft, text: e.target.value.slice(0, MAX_QUESTION_LENGTH) })}
            placeholder="Ask an essay question, e.g. 'Explain the causes of World War I in detail.'"
            maxLength={MAX_QUESTION_LENGTH}
            className="min-h-[80px] resize-none"
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

      {/* Grading info banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary flex items-start gap-2">
        <BookOpen className="h-4 w-4 shrink-0 mt-0.5" />
        <span>Long answers are always graded manually or with AI after the quiz ends.</span>
      </div>

      {/* Model answer */}
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" /> Model Answer
          <span className="normal-case font-normal text-muted-foreground/70">(optional — used as reference during grading)</span>
        </Label>
        <Textarea
          value={draft.modelAnswer}
          onChange={(e) => onChange({ ...draft, modelAnswer: e.target.value })}
          placeholder="Write an ideal answer here. Shown to graders as a reference."
          rows={4}
          className="resize-none"
        />
      </div>

      {/* Rubric */}
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5" /> Rubric / Grading Criteria
          <span className="normal-case font-normal text-muted-foreground/70">(optional)</span>
        </Label>
        <Textarea
          value={draft.rubric}
          onChange={(e) => onChange({ ...draft, rubric: e.target.value })}
          placeholder="e.g. 2 pts for identifying the main causes, 2 pts for explanation, 1 pt for examples."
          rows={3}
          className="resize-none"
        />
      </div>

      {!compact && (
        <div className="grid gap-3 md:grid-cols-4">
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
              Time (seconds)
            </Label>
            <Input
              type="number"
              min={30}
              max={3600}
              value={draft.timeSeconds}
              onChange={(e) => {
                const n = Number(e.target.value);
                onChange({ ...draft, timeSeconds: Number.isFinite(n) ? n : 300 });
              }}
              placeholder="300"
            />
          </div>
          <div>
            <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              Max Points
            </Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={draft.maxPoints}
              onChange={(e) => {
                const n = Number(e.target.value);
                onChange({ ...draft, maxPoints: Number.isFinite(n) && n >= 1 ? n : 5 });
              }}
              placeholder="5"
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
