import { Filter, X } from "lucide-react";
import type { Question } from "../types";

const DIFFICULTY_OPTS = ["all", "easy", "medium", "hard"] as const;
export type DifficultyFilter = (typeof DIFFICULTY_OPTS)[number];

type Props = {
  questions: Question[];
  filteredCount: number;
  diffFilter: DifficultyFilter;
  setDiffFilter: (v: DifficultyFilter) => void;
};

export function FilterBar({ questions, filteredCount, diffFilter, setDiffFilter }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
        <Filter size={13} /> Filter:
      </div>
      {DIFFICULTY_OPTS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => setDiffFilter(d)}
          className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-medium border transition-all capitalize ${
            diffFilter === d
              ? d === "easy"
                ? "bg-success/20 border-success/50 text-success"
                : d === "hard"
                  ? "bg-destructive/20 border-destructive/50 text-destructive"
                  : d === "medium"
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "bg-primary text-primary-foreground border-primary"
              : "bg-card/60 border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
          }`}
        >
          {d === "all"
            ? `All (${questions.length})`
            : `${d} (${questions.filter((q) => q.difficulty === d).length})`}
        </button>
      ))}
      {diffFilter !== "all" && (
        <button
          type="button"
          onClick={() => setDiffFilter("all")}
          aria-label="Clear filter"
          className="min-h-[32px] px-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-all"
        >
          <X size={12} />
        </button>
      )}
      <span className="ml-auto text-xs text-muted-foreground">
        {filteredCount} of {questions.length}
      </span>
    </div>
  );
}
