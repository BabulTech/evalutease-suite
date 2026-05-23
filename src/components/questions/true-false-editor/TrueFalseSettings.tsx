import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { type TrueFalseDraft, type Difficulty } from "../types";

type Props = { draft: TrueFalseDraft; onChange: (next: TrueFalseDraft) => void };

export function TrueFalseSettings({ draft, onChange }: Props) {
  const { t } = useI18n();
  return (
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
          placeholder="10"
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange({ ...draft, timeSeconds: Number.isFinite(n) ? n : 10 });
          }}
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
  );
}
