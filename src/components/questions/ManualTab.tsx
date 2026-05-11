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
import { DraftEditor } from "./DraftEditor";
import { emptyDraft, validateDraft, type DraftQuestion } from "./types";
import { useI18n } from "@/lib/i18n";

type Props = {
  disabled?: boolean;
  onSave: (drafts: DraftQuestion[]) => Promise<void>;
};

export function ManualTab({ disabled, onSave }: Props) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<DraftQuestion>(() => emptyDraft());
  const [saving, setSaving] = useState(false);
  const [lang, setLang] = useState<"en" | "ur">("en");

  const submit = async () => {
    const v = validateDraft(draft);
    if (!v.ok) {
      toast.error(v.reason);
      return;
    }
    setSaving(true);
    try {
      await onSave([draft]);
      setDraft(emptyDraft());
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

      <DraftEditor draft={draft} onChange={setDraft} />

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setDraft(emptyDraft())}
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
