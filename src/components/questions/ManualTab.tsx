import { useState } from "react";
import { toast } from "sonner";
import { Plus, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DraftEditorRouter } from "./DraftEditorRouter";
import { QuestionTypePicker } from "./QuestionTypePicker";
import {
  emptyDraft,
  validateDraft,
  type DraftQuestion,
  type QuestionType,
} from "./types";
import { useI18n } from "@/lib/i18n";

type Props = {
  disabled?: boolean;
  onSave: (drafts: DraftQuestion[]) => Promise<void>;
  /** Phase 2: which question types are enabled. Defaults to MCQ + T/F. */
  allowedTypes?: QuestionType[];
};

const DEFAULT_ALLOWED: QuestionType[] = ["mcq", "true_false", "short_answer", "long_answer"];

export function ManualTab({ disabled, onSave, allowedTypes = DEFAULT_ALLOWED }: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<DraftQuestion>(() => emptyDraft("mcq"));
  const [saving, setSaving] = useState(false);
  const [lang, setLang] = useState<"en" | "ur">("en");

  const changeType = (next: QuestionType) => {
    if (!allowedTypes.includes(next)) return;
    setDraft(emptyDraft(next, draft.difficulty));
  };

  const submit = async () => {
    const v = validateDraft(draft);
    if (!v.ok) {
      toast.error(v.reason);
      return;
    }
    setSaving(true);
    try {
      await onSave([draft]);
      setDraft(emptyDraft(draft.type));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Language selector */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card/30 px-4 py-3">
        <p className="text-sm text-muted-foreground flex-1">{t("q.manualHint")}</p>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <Label className="text-xs text-muted-foreground whitespace-nowrap">{t("q.aiLanguage")}</Label>
          <Select value={lang} onValueChange={(v) => setLang(v as "en" | "ur")}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t("q.aiLanguageEnglish")}</SelectItem>
              <SelectItem value="ur">{t("q.aiLanguageUrdu")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Selected language indicator */}
      {lang === "ur" && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary">
          ✦ {t("q.aiLanguageUrdu")} - سوال اور آپشن اردو میں لکھیں
        </div>
      )}

      {/* Question type picker */}
      <div>
        <Label className="mb-2 text-xs uppercase tracking-wider text-muted-foreground block">
          Question Type
        </Label>
        <QuestionTypePicker
          value={draft.type}
          onChange={changeType}
          allowedTypes={allowedTypes}
        />
      </div>

      <DraftEditorRouter draft={draft} onChange={setDraft} />

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setDraft(emptyDraft(draft.type))}
          disabled={saving}
        >
          {t("q.reset")}
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={disabled || saving}
          className="bg-gradient-primary text-primary-foreground shadow-glow"
        >
          <Plus className="h-4 w-4 mr-1" />
          {saving ? t("common.saving") : t("q.addQuestion")}
        </Button>
      </div>
    </div>
  );
}
