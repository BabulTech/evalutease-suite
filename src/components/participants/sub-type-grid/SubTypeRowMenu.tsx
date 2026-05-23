import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SubTypeDialog, type SubTypeDraft } from "../SubTypeDialog";
import { DeleteConfirmDialog } from "../shared/DeleteConfirmDialog";

export type SubTypeCardMin = { id: string; name: string; description: string | null };

type Props = {
  sub: SubTypeCardMin;
  onEdit: (id: string, draft: SubTypeDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function SubTypeRowMenu({ sub, onEdit, onDelete }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40"
          aria-label="Open menu"
        >
          <MoreHorizontal className="size-4" />
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
              <Pencil className="size-3.5" /> Edit
            </DropdownMenuItem>
          }
        />
        <DeleteConfirmDialog
          title={`Delete "${sub.name}"?`}
          description="Participants in this group are kept but lose this assignment."
          onConfirm={() => void onDelete(sub.id)}
          trigger={
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="size-3.5" /> Delete
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
