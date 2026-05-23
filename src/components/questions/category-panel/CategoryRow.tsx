import { GraduationCap, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import type { Category } from "../types";
import { SUBJECT_PRESETS } from "./constants";
import { CategoryDialog } from "./CategoryDialog";
import { DeleteCategoryButton } from "./DeleteCategoryButton";

type Props = {
  category: Category;
  active: boolean;
  count: number;
  onSelect: () => void;
  onRename: (v: { name: string; subject: string | null }) => Promise<void>;
  onDelete: () => Promise<void>;
};

export function CategoryRow({ category: c, active, count, onSelect, onRename, onDelete }: Props) {
  return (
    <div
      className={`group flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-all ${
        active
          ? "border-primary/40 bg-primary/10 shadow-glow"
          : "border-border bg-card/40 hover:border-primary/30 hover:bg-card"
      }`}
    >
      <button
        type="button"
        className="flex flex-1 items-center gap-2 min-w-0 text-left"
        onClick={onSelect}
      >
        {c.subject === "academic" ? (
          <GraduationCap
            className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
          />
        ) : (
          <Globe
            className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-medium truncate ${active ? "text-primary" : ""}`}>
            {c.name}
          </div>
          {c.subject && (
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {SUBJECT_PRESETS.find((s) => s.value === c.subject)?.label ?? c.subject}
            </div>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {count}
        </span>
      </button>
      <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
        <CategoryDialog
          mode="edit"
          initial={c}
          onSubmit={onRename}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </Button>
          }
        />
        <DeleteCategoryButton category={c} onConfirm={onDelete} />
      </div>
    </div>
  );
}
