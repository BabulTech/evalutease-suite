import { Sparkles, Coins } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Props = {
  isFreeAi: boolean;
  freeAiUsed: number | null;
  freeAiRemaining: number;
  freeAiLimit: number;
  creditsBalance: number;
  count: number;
  totalCost: number;
};

export function AiTabHeader({
  isFreeAi,
  freeAiUsed,
  freeAiRemaining,
  freeAiLimit,
  creditsBalance,
  count,
  totalCost,
}: Props) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-primary">
          <Sparkles className="size-4" /> {t("q.aiTitle")}
        </div>
        {isFreeAi ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-warning" />
            <span className="text-warning font-semibold">
              {freeAiUsed === null ? "…" : freeAiRemaining}
            </span>
            <span>/ {freeAiLimit} free AI calls remaining</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Coins className="size-3.5 text-warning" />
            <span className="text-warning font-semibold">{creditsBalance}</span>
            <span>credits · {count} questions =</span>
            <span className="font-semibold text-foreground">{totalCost} credits</span>
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t("q.aiDesc")}</p>
    </div>
  );
}
