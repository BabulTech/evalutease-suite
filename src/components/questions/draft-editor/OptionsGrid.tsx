import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { type McqDraft, MAX_OPTION_LENGTH, labelFor } from "../types";

type Props = { draft: McqDraft; onChange: (next: McqDraft) => void };

export function OptionsGrid({ draft, onChange }: Props) {
  const { t } = useI18n();

  return (
    <div className="grid gap-2">
      {draft.options.map((opt, i) => {
        const isCorrect = draft.correctIndex === i;
        return (
          <div
            key={`${i}-${opt}`}
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
              {isCorrect ? <CheckCircle2 className="size-4" /> : labelFor(i)}
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
  );
}
