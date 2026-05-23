import { Clock } from "lucide-react";
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
import { type ShortAnswerDraft, type Difficulty } from "../types";

type Props = { draft: ShortAnswerDraft; onChange: (next: ShortAnswerDraft) => void };

export function ShortAnswerSettings({ draft, onChange }: Props) {
  const { t } = useI18n();
  return (
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
        <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Clock className="size-3" /> Time Limit
        </Label>
        <div className="flex items-center gap-1.5">
          <Select
            value={String(Math.floor(draft.timeSeconds / 60))}
            onValueChange={(v) =>
              onChange({ ...draft, timeSeconds: Number(v) * 60 + (draft.timeSeconds % 60) })
            }
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4, 5, 10, 15, 20, 30].map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m}m
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(draft.timeSeconds % 60)}
            onValueChange={(v) =>
              onChange({
                ...draft,
                timeSeconds: Math.floor(draft.timeSeconds / 60) * 60 + Number(v),
              })
            }
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[0, 15, 30, 45].map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}s
                </SelectItem>
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
        <Input
          type="number"
          min={1}
          max={100}
          value={draft.maxPoints}
          placeholder="1"
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange({ ...draft, maxPoints: Number.isFinite(n) && n >= 1 ? Math.min(n, 100) : 1 });
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
