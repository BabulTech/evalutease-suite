import { Link } from "@tanstack/react-router";
import { ArrowRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { iconFor } from "./icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CategoryDialog, type CategoryDraft } from "./CategoryDialog";
import type { IconKey } from "./icons";
import type { ReactNode } from "react";

export type CategoryCard = {
  id: string;
  name: string;
  icon: IconKey | null;
  subcategoryCount: number;
  questionCount: number;
};

type Props = {
  categories: CategoryCard[];
  onEdit: (id: string, draft: CategoryDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  emptyState?: ReactNode;
};

export function CategoryGrid({ categories, onEdit, onDelete, emptyState }: Props) {
  if (categories.length === 0 && emptyState) return <>{emptyState}</>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {categories.map((c) => {
        const Icon = iconFor(c.icon);
        return (
          <div
            key={c.id}
            className="group relative rounded-2xl border border-border bg-card/60 p-5 hover:border-primary/40 hover:shadow-glow transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow">
                <Icon className="h-6 w-6" />
              </div>
              <CategoryRowMenu category={c} onEdit={onEdit} onDelete={onDelete} />
            </div>
            <Link
              to="/categories/$categoryId"
              params={{ categoryId: c.id }}
              className="block mt-4"
            >
              <div className="font-display text-lg font-semibold">{c.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {c.subcategoryCount} sub-categor{c.subcategoryCount === 1 ? "y" : "ies"} ·{" "}
                {c.questionCount} question{c.questionCount === 1 ? "" : "s"}
              </div>
              <div className="mt-3 flex items-center gap-1 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Open <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function CategoryRowMenu({
  category,
  onEdit,
  onDelete,
}: {
  category: CategoryCard;
  onEdit: (id: string, draft: CategoryDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40"
          aria-label="Open menu"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <CategoryDialog
          title="Edit category"
          submitLabel="Save changes"
          initial={{ name: category.name, icon: (category.icon ?? "book") as IconKey }}
          onSubmit={(draft) => onEdit(category.id, draft)}
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </DropdownMenuItem>
          }
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{category.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                All sub-categories and questions inside it will be deleted too. This can't be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void onDelete(category.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
