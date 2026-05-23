import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TypeDialog, type TypeDraft } from "../TypeDialog";
import { DeleteConfirmDialog } from "../shared/DeleteConfirmDialog";
import type { IconKey } from "@/components/categories/icons";

export type TypeCardMin = { id: string; name: string; icon: IconKey | null };

type Props = {
  type: TypeCardMin;
  onEdit: (id: string, draft: TypeDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function TypeRowMenu({ type, onEdit, onDelete }: Props) {
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
        <TypeDialog
          title="Edit type"
          submitLabel="Save changes"
          initial={{ name: type.name, icon: (type.icon ?? "person") as IconKey }}
          onSubmit={(draft) => onEdit(type.id, draft)}
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="gap-2">
              <Pencil className="size-3.5" /> Edit
            </DropdownMenuItem>
          }
        />
        <DeleteConfirmDialog
          title={`Delete "${type.name}"?`}
          description="All groups under this type will be deleted too. Participants are kept but lose their group assignment."
          onConfirm={() => void onDelete(type.id)}
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
