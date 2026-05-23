import { Check } from "lucide-react";

export function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {[1, 2].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
          >
            {step > s ? <Check size={14} /> : s}
          </div>
          {s < 2 && (
            <div
              className={`h-px flex-1 w-10 transition-all ${step > 1 ? "bg-primary" : "bg-border"}`}
            />
          )}
        </div>
      ))}
      <span className="ml-2 text-xs text-muted-foreground">
        {step === 1 ? "Choose Plan" : "Your Profile"}
      </span>
    </div>
  );
}
