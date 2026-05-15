import { Link } from "@tanstack/react-router";
import { ArrowRight, MoreHorizontal, Pencil, Trash2, UsersRound } from "lucide-react";
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
import { SubTypeDialog, type SubTypeDraft } from "./SubTypeDialog";
import type { ReactNode } from "react";

export type SubTypeCard = {
  id: string;
  type_id: string;
  name: string;
  description: string | null;
  participantCount: number;
};

type Props = {
  subtypes: SubTypeCard[];
  onEdit: (id: string, draft: SubTypeDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  emptyState?: ReactNode;
};

export function SubTypeGrid({ subtypes, onEdit, onDelete, emptyState }: Props) {
  if (subtypes.length === 0 && emptyState) return <>{emptyState}</>;

  const maxP = Math.max(...subtypes.map((s) => s.participantCount), 1);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {subtypes.map((s) => {
        const fillPct = Math.round((s.participantCount / maxP) * 100);
        return (
          <div
            key={s.id}
            className="group relative rounded-2xl border border-border bg-card/60 hover:border-primary/40 hover:shadow-glow transition-all duration-200 overflow-hidden"
          >
            <div className="absolute top-3 right-3 z-10">
              <SubTypeRowMenu sub={s} onEdit={onEdit} onDelete={onDelete} />
            </div>

            <Link
              to="/participant-types/$typeId/$subId"
              params={{ typeId: s.type_id, subId: s.id }}
              className="block p-5 pr-10"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <UsersRound className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base font-semibold truncate">{s.name}</div>
                  {s.description && (
                    <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{s.description}</div>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {s.participantCount} {s.participantCount === 1 ? "participant" : "participants"}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
                    Open <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-primary/50 transition-all ${
                      fillPct <= 10 ? "w-[10%]" : fillPct <= 20 ? "w-1/5"
                      : fillPct <= 25 ? "w-1/4" : fillPct <= 33 ? "w-1/3"
                      : fillPct <= 50 ? "w-1/2" : fillPct <= 66 ? "w-2/3"
                      : fillPct <= 75 ? "w-3/4" : fillPct <= 90 ? "w-[90%]" : "w-full"
                    }`}
                  />
                </div>
              </div>
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function SubTypeRowMenu({
  sub,
  onEdit,
  onDelete,
}: {
  sub: SubTypeCard;
  onEdit: (id: string, draft: SubTypeDraft) => Promise<void>;
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
        <SubTypeDialog
          title="Edit group"
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
                Participants in this group are kept but lose this assignment.
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
