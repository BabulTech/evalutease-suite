import { Folder, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Category } from "./types";
import { CategoryDialog } from "./category-panel/CategoryDialog";
import { CategoryRow } from "./category-panel/CategoryRow";

type Props = {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (input: { name: string; subject: string | null }) => Promise<void>;
  onRename: (id: string, input: { name: string; subject: string | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  questionCounts: Record<string, number>;
};

export function CategoryPanel({
  categories,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  questionCounts,
}: Props) {
  return (
    <aside className="w-full lg:w-72 lg:shrink-0 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Categories
        </h2>
        <CategoryDialog
          mode="create"
          onSubmit={onCreate}
          trigger={
            <Button size="sm" variant="ghost" className="gap-1.5 text-primary">
              <FolderPlus className="size-4" /> New
            </Button>
          }
        />
      </div>

      {categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-6 text-center">
          <Folder className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-2 text-sm font-medium">No categories yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create one like <span className="font-medium text-foreground">History</span>,{" "}
            <span className="font-medium text-foreground">Science</span>, or{" "}
            <span className="font-medium text-foreground">Class 5</span>.
          </p>
          <CategoryDialog
            mode="create"
            onSubmit={onCreate}
            trigger={
              <Button size="sm" className="mt-3 gap-1.5">
                <FolderPlus className="size-4" /> Create category
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="space-y-1.5">
          {categories.map((c) => (
            <li key={c.id}>
              <CategoryRow
                category={c}
                active={c.id === selectedId}
                count={questionCounts[c.id] ?? 0}
                onSelect={() => onSelect(c.id)}
                onRename={(v) => onRename(c.id, v)}
                onDelete={() => onDelete(c.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
