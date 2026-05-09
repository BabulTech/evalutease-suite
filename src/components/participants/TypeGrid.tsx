import { Link } from "@tanstack/react-router";
import { ArrowRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { iconFor, type IconKey } from "@/components/categories/icons";
import { TypeDialog, type TypeDraft } from "./TypeDialog";
import type { ReactNode } from "react";

export type TypeCard = {
  id: string;
  name: string;
  icon: IconKey | null;
  subtypeCount: number;
  participantCount: number;
};

type Props = {
  types: TypeCard[];
  onEdit: (id: string, draft: TypeDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  emptyState?: ReactNode;
};

export function TypeGrid({ types, onEdit, onDelete, emptyState }: Props) {
  if (types.length === 0 && emptyState) return <>{emptyState}</>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {types.map((c) => {
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
              <TypeRowMenu type={c} onEdit={onEdit} onDelete={onDelete} />
            </div>
            <Link
              to="/participant-types/$typeId"
              params={{ typeId: c.id }}
              className="block mt-4"
            >
              <div className="font-display text-lg font-semibold">{c.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {c.subtypeCount} group{c.subtypeCount === 1 ? "" : "s"} ·{" "}
                {c.participantCount} participant{c.participantCount === 1 ? "" : "s"}
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

function TypeRowMenu({
  type,
  onEdit,
  onDelete,
}: {
  type: TypeCard;
  onEdit: (id: string, draft: TypeDraft) => Promise<void>;
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
        <TypeDialog
          title="Edit type"
          submitLabel="Save changes"
          initial={{ name: type.name, icon: (type.icon ?? "person") as IconKey }}
          onSubmit={(draft) => onEdit(type.id, draft)}
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
              <AlertDialogTitle>Delete "{type.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                All groups under this type will be deleted too. Participants are kept but lose
                their group assignment.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void onDelete(type.id)}
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
