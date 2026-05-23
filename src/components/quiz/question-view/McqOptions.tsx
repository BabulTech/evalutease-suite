import { Check } from "lucide-react";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

type Props = {
  options: string[];
  chosen: string | null;
  isAnswered: boolean;
  disabled: boolean;
  onLock: (value: string) => void;
};

export function McqOptions({ options, chosen, isAnswered, disabled, onLock }: Props) {
  return (
    <div className="mt-6 grid gap-2 sm:grid-cols-2">
      {options.map((option, i) => {
        const isChosen = chosen === option;
        return (
          <button
            key={`${i}-${option}`}
            type="button"
            disabled={disabled}
            onClick={() => onLock(option)}
            className={`text-left rounded-2xl border-2 px-4 py-3 transition-all ${
              isChosen
                ? "border-primary bg-primary/15 shadow-glow"
                : isAnswered
                  ? "border-border bg-card/30 opacity-60"
                  : "border-border bg-card/40 hover:border-primary/50"
            } ${!disabled ? "cursor-pointer" : "cursor-default"}`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  isChosen ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {isChosen ? <Check className="size-4" /> : (LETTERS[i] ?? i + 1)}
              </span>
              <span className="text-sm sm:text-base font-medium">{option}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
