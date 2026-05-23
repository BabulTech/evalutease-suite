import { useI18n } from "@/lib/i18n";
import { type McqDraft } from "./types";
import { QuestionStem } from "./draft-editor/QuestionStem";
import { OptionsGrid } from "./draft-editor/OptionsGrid";
import { McqSettings } from "./draft-editor/McqSettings";

type Props = {
  draft: McqDraft;
  index?: number;
  onChange: (next: McqDraft) => void;
  onRemove?: () => void;
  compact?: boolean;
};

export function DraftEditor({ draft, index, onChange, onRemove, compact }: Props) {
  const { t } = useI18n();

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
      <QuestionStem draft={draft} index={index} onChange={onChange} onRemove={onRemove} />
      <OptionsGrid draft={draft} onChange={onChange} />
      {!compact && <McqSettings draft={draft} onChange={onChange} />}
      <p className="text-xs text-muted-foreground">{t("q.tip")}</p>
    </div>
  );
}
