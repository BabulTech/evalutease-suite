import { Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { type TrueFalseDraft, MAX_QUESTION_LENGTH } from "./types";
import { TrueFalsePicker } from "./true-false-editor/TrueFalsePicker";
import { TrueFalseSettings } from "./true-false-editor/TrueFalseSettings";

type Props = {
  draft: TrueFalseDraft;
  index?: number;
  onChange: (next: TrueFalseDraft) => void;
  onRemove?: () => void;
  compact?: boolean;
};

export function TrueFalseEditor({ draft, index, onChange, onRemove, compact }: Props) {
  const { t } = useI18n();
  const overLimit = draft.text.length > MAX_QUESTION_LENGTH;

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              {typeof index === "number" ? `${t("q.question")} ${index + 1}` : t("q.question")}
              <span className="ml-2 text-[10px] font-bold text-primary">· TRUE / FALSE</span>
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
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      <TrueFalsePicker draft={draft} onChange={onChange} />
      {!compact && <TrueFalseSettings draft={draft} onChange={onChange} />}
    </div>
  );
}
