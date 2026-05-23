import { Check, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { TrueFalseDraft } from "../types";

type Props = { draft: TrueFalseDraft; onChange: (next: TrueFalseDraft) => void };

export function TrueFalsePicker({ draft, onChange }: Props) {
  return (
    <div>
      <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        Correct answer
      </Label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...draft, correctValue: true })}
          className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 transition-all ${
            draft.correctValue
              ? "border-success bg-success/15 text-success shadow-glow"
              : "border-border bg-card/40 text-muted-foreground hover:border-success/50"
          }`}
        >
          <Check className="size-5" />
          <span className="font-semibold">True</span>
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...draft, correctValue: false })}
          className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 transition-all ${
            !draft.correctValue
              ? "border-destructive bg-destructive/15 text-destructive shadow-glow"
              : "border-border bg-card/40 text-muted-foreground hover:border-destructive/50"
          }`}
        >
          <X className="size-5" />
          <span className="font-semibold">False</span>
        </button>
      </div>
    </div>
  );
}
