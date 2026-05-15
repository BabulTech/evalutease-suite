import { Trash2, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  type TrueFalseDraft,
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
  draft: TrueFalseDraft;
  index?: number;
  onChange: (next: TrueFalseDraft) => void;
  onRemove?: () => void;
  compact?: boolean;
};

export function TrueFalseEditor({ draft, index, onChange, onRemove, compact }: Props) {
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
              <span className="ml-2 text-[10px] font-bold text-primary">· TRUE / FALSE</span>
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
            placeholder="Enter a true/false statement, e.g. 'The Earth orbits the Sun.'"
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

      <div>
        <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          Correct answer
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...draft, correctValue: true })}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 transition-all ${
              draft.correctValue
                ? "border-success bg-success/15 text-success shadow-glow"
                : "border-border bg-card/40 text-muted-foreground hover:border-success/50"
            }`}
          >
            <Check className="h-5 w-5" />
            <span className="font-semibold">True</span>
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...draft, correctValue: false })}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 transition-all ${
              !draft.correctValue
                ? "border-destructive bg-destructive/15 text-destructive shadow-glow"
                : "border-border bg-card/40 text-muted-foreground hover:border-destructive/50"
            }`}
          >
            <X className="h-5 w-5" />
            <span className="font-semibold">False</span>
          </button>
        </div>
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
    </div>
  );
}
