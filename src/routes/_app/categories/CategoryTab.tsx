import { BookOpen, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChipSelector } from "./ChipSelector";
import type { Cat } from "./types";

type Props = {
  cats: Cat[];
  catQuestionCounts: Map<string, number>;
  selectedCat: string;
  totalQuestions: number;
  catCount: number;
  onPickCat: (id: string) => void;
  onNewCat: () => void;
};

export function CategoryTab({
  cats,
  catQuestionCounts,
  selectedCat,
  totalQuestions,
  catCount,
  onPickCat,
  onNewCat,
}: Props) {
  return (
    <>
      <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-foreground">
            {cats.length === 0 ? "Start by creating a category" : "Choose a category"}
          </div>
          <button
            type="button"
            onClick={onNewCat}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
          >
            <FolderPlus size={13} /> New Category
          </button>
        </div>

        {cats.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <BookOpen className="mx-auto size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Categories are folders for your questions (e.g. English, Math)
            </p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onNewCat}>
              <FolderPlus size={14} /> Create first category
            </Button>
          </div>
        ) : (
          <ChipSelector
            items={cats.map((c) => ({
              id: c.id,
              label: c.name,
              count: catQuestionCounts.get(c.id) ?? 0,
            }))}
            selected={selectedCat}
            onSelect={onPickCat}
          />
        )}
      </div>

      {totalQuestions > 0 && (
        <div className="text-center text-xs text-muted-foreground">
          {totalQuestions} questions across {catCount} {catCount === 1 ? "category" : "categories"}
        </div>
      )}
    </>
  );
}
