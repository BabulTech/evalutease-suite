import { ListChecks, ToggleLeft, Shuffle, PenLine, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";

type GenKind = "mcq" | "true_false" | "short_answer" | "long_answer" | "mix";

const KINDS = [
  {
    value: "mcq" as const,
    label: "Multiple Choice",
    Icon: ListChecks,
    desc: "4 options, 1 correct",
  },
  {
    value: "true_false" as const,
    label: "True / False",
    Icon: ToggleLeft,
    desc: "Statement is T or F",
  },
  {
    value: "short_answer" as const,
    label: "Short Answer",
    Icon: PenLine,
    desc: "Type a brief reply",
  },
  { value: "long_answer" as const, label: "Long Answer", Icon: FileText, desc: "Essay question" },
  { value: "mix" as const, label: "Mix (Random)", Icon: Shuffle, desc: "Claude varies types" },
];

type Props = { kind: GenKind; onChange: (k: GenKind) => void };

export function QuestionKindPicker({ kind, onChange }: Props) {
  return (
    <div>
      <Label className="mb-2 text-xs uppercase tracking-wider text-muted-foreground block">
        Question Type
      </Label>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {KINDS.map(({ value, label, Icon, desc }) => {
          const active = kind === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              className={`rounded-2xl border p-3 text-left transition-all ${
                active
                  ? "border-primary bg-primary/10 shadow-glow"
                  : "border-border bg-card/40 hover:border-primary/50 cursor-pointer"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm font-semibold ${active ? "text-primary" : ""}`}>
                  {label}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { GenKind };
