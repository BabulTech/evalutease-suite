import { Link } from "@tanstack/react-router";
import { ArrowRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { iconFor } from "./icons";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
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

  const totalQuestions = categories.reduce((s, c) => s + c.questionCount, 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {categories.map((c) => {
        const Icon = iconFor(c.icon);
        const sharePct = totalQuestions > 0
          ? Math.round((c.questionCount / totalQuestions) * 100)
          : 0;

        return (
          <div
            key={c.id}
            className="group relative rounded-2xl border border-border bg-card/60 hover:border-primary/40 hover:shadow-glow transition-all duration-200 overflow-hidden"
          >
            {/* Menu */}
            <div className="absolute top-3 right-3 z-10">
              <CategoryRowMenu category={c} onEdit={onEdit} onDelete={onDelete} />
            </div>

            {/* Full-card link */}
            <Link
              to="/categories/$categoryId"
              params={{ categoryId: c.id }}
              className="block p-5 pr-10"
            >
              {/* Icon */}
              <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow mb-4">
                <Icon className="h-6 w-6" />
              </div>

              {/* Name */}
              <div className="font-display text-lg font-bold truncate">{c.name}</div>

              {/* Stats */}
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{c.questionCount}</span> questions
                </span>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{c.subcategoryCount}</span> {c.subcategoryCount === 1 ? "topic" : "topics"}
                </span>
              </div>

              {/* Open + share indicator */}
              <div className="mt-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
                  Browse <ArrowRight className="h-3.5 w-3.5" />
                </span>
                {totalQuestions > 0 && (
                  <span className="text-[10px] text-muted-foreground">{sharePct}% of bank</span>
                )}
              </div>

              {/* Fill bar */}
              {totalQuestions > 0 && (
                <div className="mt-2 h-1 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-primary/60 transition-all ${
                      sharePct <= 10 ? "w-[10%]" : sharePct <= 20 ? "w-1/5"
                      : sharePct <= 25 ? "w-1/4" : sharePct <= 33 ? "w-1/3"
                      : sharePct <= 50 ? "w-1/2" : sharePct <= 66 ? "w-2/3"
                      : sharePct <= 75 ? "w-3/4" : sharePct <= 90 ? "w-[90%]" : "w-full"
                    }`}
                  />
                </div>
              )}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function CategoryRowMenu({
  category, onEdit, onDelete,
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
          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 min-h-[32px] min-w-[32px] flex items-center justify-center"
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
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2 text-destructive focus:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{category.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                All topics and questions inside it will be deleted permanently.
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
