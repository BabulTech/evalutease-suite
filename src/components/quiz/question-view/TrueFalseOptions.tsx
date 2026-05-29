import { Check, X } from "lucide-react";

type Props = {
  chosen: string | null;
  isAnswered: boolean;
  disabled: boolean;
  onLock: (value: string) => void;
};

export function TrueFalseOptions({ chosen, isAnswered, disabled, onLock }: Props) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3">
      {[
        { value: "true", label: "True", Icon: Check, color: "success" as const },
        { value: "false", label: "False", Icon: X, color: "destructive" as const },
      ].map(({ value, label, Icon, color }) => {
        const isChosen = chosen === value;
        return (
          <button
            key={value}
            type="button"
            disabled={disabled}
            onClick={() => onLock(value)}
            className={`flex items-center justify-center gap-2 sm:gap-3 rounded-2xl border-2 px-3 sm:px-6 py-6 sm:py-8 transition-all min-w-0 ${
              isChosen
                ? color === "success"
                  ? "border-success bg-success/15 text-success shadow-glow"
                  : "border-destructive bg-destructive/15 text-destructive shadow-glow"
                : isAnswered
                  ? "border-border bg-card/30 opacity-60"
                  : "border-border bg-card/40 hover:border-primary/50"
            } ${!disabled ? "cursor-pointer" : "cursor-default"}`}
          >
            <Icon className="size-7" />
            <span className="text-lg sm:text-xl font-bold">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
