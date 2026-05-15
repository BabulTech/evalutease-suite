import { ListChecks, ToggleLeft, PenLine, FileText, Lock } from "lucide-react";
import { QUESTION_TYPES, type QuestionType } from "./types";

const ICON_MAP: Record<QuestionType, typeof ListChecks> = {
  mcq: ListChecks,
  true_false: ToggleLeft,
  short_answer: PenLine,
  long_answer: FileText,
};

type Props = {
  value: QuestionType;
  onChange: (next: QuestionType) => void;
  /** When set, only these types are clickable. Others appear locked. */
  allowedTypes?: QuestionType[];
  className?: string;
};

// Chip-style picker, rendered at the top of every question editor.
// Phase 1: clicking switches the active draft to a fresh empty of that
// type — caller decides how to handle the reset.
export function QuestionTypePicker({ value, onChange, allowedTypes, className }: Props) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-2 ${className ?? ""}`}>
      {QUESTION_TYPES.map(({ value: type, label, description }) => {
        const Icon = ICON_MAP[type];
        const isActive = value === type;
        const isLocked = !!allowedTypes && !allowedTypes.includes(type);
        return (
          <button
            key={type}
            type="button"
            disabled={isLocked}
            onClick={() => onChange(type)}
            className={`rounded-2xl border p-3 text-left transition-all ${
              isActive
                ? "border-primary bg-primary/10 shadow-glow"
                : isLocked
                  ? "border-border bg-muted/20 opacity-50 cursor-not-allowed"
                  : "border-border bg-card/40 hover:border-primary/50 hover:bg-card/70 cursor-pointer"
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-sm font-semibold ${isActive ? "text-primary" : ""}`}>
                {label}
              </span>
              {isLocked && <Lock className="h-3 w-3 ml-auto text-muted-foreground" />}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{description}</p>
          </button>
        );
      })}
    </div>
  );
}
