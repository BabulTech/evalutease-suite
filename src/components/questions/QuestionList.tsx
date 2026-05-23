import { useState, useMemo } from "react";
import { type DraftQuestion, type Question } from "./types";
import { FilterBar, type DifficultyFilter } from "./question-list/FilterBar";
import { QuestionCard } from "./question-list/QuestionCard";

type Props = {
  questions: Question[];
  loading: boolean;
  onUpdate: (id: string, draft: DraftQuestion) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  usageCounts?: Map<string, number>;
  lastUsed?: Map<string, string>;
};

export function QuestionList({
  questions,
  loading,
  onUpdate,
  onDelete,
  usageCounts,
  lastUsed,
}: Props) {
  const [diffFilter, setDiffFilter] = useState<DifficultyFilter>("all");
  const [searchFilter] = useState("");

  const filtered = useMemo(() => {
    let qs = questions;
    if (diffFilter !== "all") qs = qs.filter((q) => q.difficulty === diffFilter);
    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      qs = qs.filter((q) => q.text.toLowerCase().includes(term));
    }
    return qs;
  }, [questions, diffFilter, searchFilter]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground animate-pulse">
        Loading questions…
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center">
        <p className="text-sm font-medium">No questions yet in this topic</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Use the tabs above to add them manually, scan an image, generate with AI, or upload a
          file.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <FilterBar
        questions={questions}
        filteredCount={filtered.length}
        diffFilter={diffFilter}
        setDiffFilter={setDiffFilter}
      />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/30 p-6 text-center text-sm text-muted-foreground">
          No questions match the current filter.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((q, idx) => (
            <li key={q.id}>
              <QuestionCard
                q={q}
                index={idx + 1}
                onUpdate={onUpdate}
                onDelete={onDelete}
                usageCount={usageCounts?.get(q.id) ?? 0}
                lastUsedAt={lastUsed?.get(q.id) ?? null}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
