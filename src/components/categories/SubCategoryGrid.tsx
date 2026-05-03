import { Link } from "@tanstack/react-router";
import { ArrowRight, FolderOpen, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { SubCategoryDialog, type SubCategoryDraft } from "./SubCategoryDialog";
import type { ReactNode } from "react";

export type SubCategoryCard = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  questionCount: number;
};

type Props = {
  subcategories: SubCategoryCard[];
  onEdit: (id: string, draft: SubCategoryDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  emptyState?: ReactNode;
};

export function SubCategoryGrid({ subcategories, onEdit, onDelete, emptyState }: Props) {
  if (subcategories.length === 0 && emptyState) return <>{emptyState}</>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {subcategories.map((s) => (
        <div
          key={s.id}
          className="group relative rounded-2xl border border-border bg-card/60 p-5 hover:border-primary/40 hover:shadow-glow transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FolderOpen className="h-5 w-5" />
            </div>
            <SubCategoryRowMenu sub={s} onEdit={onEdit} onDelete={onDelete} />
          </div>
          <Link
            to="/categories/$categoryId/$subId"
            params={{ categoryId: s.category_id, subId: s.id }}
            className="block mt-4"
          >
            <div className="font-display text-base font-semibold">{s.name}</div>
            {s.description && (
              <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {s.description}
              </div>
            )}
            <div className="mt-2 text-xs text-muted-foreground">
              {s.questionCount} question{s.questionCount === 1 ? "" : "s"}
            </div>
            <div className="mt-3 flex items-center gap-1 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
              Open <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
}

function SubCategoryRowMenu({
  sub,
  onEdit,
  onDelete,
}: {
  sub: SubCategoryCard;
  onEdit: (id: string, draft: SubCategoryDraft) => Promise<void>;
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
        <SubCategoryDialog
          title="Edit sub-category"
          submitLabel="Save changes"
          initial={{ name: sub.name, description: sub.description ?? "" }}
          onSubmit={(draft) => onEdit(sub.id, draft)}
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
              <AlertDialogTitle>Delete "{sub.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                All questions inside it will be detached (their category remains).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void onDelete(sub.id)}
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
