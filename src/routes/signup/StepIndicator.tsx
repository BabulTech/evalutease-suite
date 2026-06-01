import { Check } from "lucide-react";

const LABELS: Record<number, string> = {
  1: "Account Type",
  2: "",
  3: "Personal Info",
  4: "Account",
  5: "Preferences",
  6: "Verification",
};

export function StepIndicator({ step, totalSteps = 6 }: { step: number; totalSteps?: number }) {
  return (
    <div className="flex items-center gap-1 mb-6">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
        <div key={s} className="flex items-center gap-1 flex-1 last:flex-none">
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
              step > s
                ? "bg-primary text-primary-foreground"
                : step === s
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                  : "bg-secondary text-muted-foreground"
            }`}
          >
            {step > s ? <Check size={12} /> : s}
          </div>
          {s < totalSteps && (
            <div className={`h-px flex-1 transition-all ${step > s ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
      <span className="ml-2 text-xs text-muted-foreground whitespace-nowrap">
        {LABELS[step] ?? ""}
      </span>
    </div>
  );
}
