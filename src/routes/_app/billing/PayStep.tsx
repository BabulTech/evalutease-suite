import { ArrowLeft, Zap } from "lucide-react";
import type { PlanInfo } from "@/contexts/PlanContext";
import { StepHeader } from "./StepHeader";
import { METHOD_ICONS } from "./constants";
import type { PaymentAccount } from "./types";

type Props = {
  selectedPlan: PlanInfo;
  accounts: PaymentAccount[];
  onSelectMethod: (method: string) => void;
  onBack: () => void;
};

export function PayStep({ selectedPlan, accounts, onSelectMethod, onBack }: Props) {
  return (
    <div className="max-w-lg mx-auto space-y-4">
      <StepHeader
        title="How would you like to pay?"
        sub={`${selectedPlan.name}, PKR ${selectedPlan.price_pkr}`}
        onBack={onBack}
      />

      <div className="rounded-2xl border border-primary/25 bg-primary/5 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-sm">{selectedPlan.name}</p>
          <p className="text-xs text-warning mt-0.5 flex items-center gap-1">
            <Zap className="size-3" /> {selectedPlan.credits_per_month} credits
          </p>
        </div>
        <p className="font-display text-2xl font-bold">PKR {selectedPlan.price_pkr}</p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          Select a payment method
        </p>
        {accounts.map((acc) => (
          <button
            key={acc.id}
            type="button"
            onClick={() => onSelectMethod(acc.method)}
            className="w-full rounded-2xl border border-border bg-card/50 p-4 flex items-center gap-4 hover:border-primary/50 hover:shadow-glow transition-all min-h-[72px] text-left"
          >
            <span className="text-3xl shrink-0">{METHOD_ICONS[acc.method] ?? "💳"}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{acc.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">{acc.account_number}</p>
            </div>
            <ArrowLeft className="size-4 text-muted-foreground rotate-180 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
