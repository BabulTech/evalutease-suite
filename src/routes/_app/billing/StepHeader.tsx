import { ArrowLeft } from "lucide-react";

type Props = { title: string; sub: string; onBack: () => void };

export function StepHeader({ title, sub, onBack }: Props) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        aria-label="Go back"
        className="size-9 rounded-xl border border-border flex items-center justify-center hover:bg-muted/40 transition-colors shrink-0"
      >
        <ArrowLeft className="size-4" />
      </button>
      <div>
        <p className="font-display text-lg font-bold leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
