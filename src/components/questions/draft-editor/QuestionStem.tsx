import { Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { type McqDraft, MAX_QUESTION_LENGTH } from "../types";

type Props = {
  draft: McqDraft;
  index?: number;
  onChange: (next: McqDraft) => void;
  onRemove?: () => void;
};

export function QuestionStem({ draft, index, onChange, onRemove }: Props) {
  const { t } = useI18n();
  const overLimit = draft.text.length > MAX_QUESTION_LENGTH;

  return (
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
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  );
}
