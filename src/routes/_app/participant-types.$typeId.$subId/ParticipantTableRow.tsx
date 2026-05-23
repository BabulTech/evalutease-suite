import { useState } from "react";
import { Armchair, ChevronDown, ChevronUp, Hash, Mail, Pencil, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ParticipantDialog } from "@/components/participants/ParticipantDialog";
import {
  draftFromParticipant,
  type Participant,
  type ParticipantDraft,
} from "@/components/participants/types";

function DeleteParticipantButton({
  p,
  onConfirm,
}: {
  p: Participant;
  onConfirm: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {p.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They'll be removed from your roster. Past attempts in completed sessions are kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await onConfirm(p.id);
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ParticipantTableRow({
  p,
  selected,
  onSelect,
  onUpdate,
  onDelete,
}: {
  p: Participant;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (id: string, d: ParticipantDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <TableRow
      className={`cursor-pointer transition-colors ${selected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/30"}`}
      onClick={onSelect}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          {selected ? (
            <ChevronUp className="size-3.5 text-primary shrink-0" />
          ) : (
            <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
          )}
          <div>
            <div className={`font-medium ${selected ? "text-primary" : ""}`}>{p.name}</div>
            {p.metadata.class && (
              <div className="text-xs text-muted-foreground">{p.metadata.class}</div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm space-y-0.5">
          {p.email && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Mail className="size-3" />
              <span className="truncate max-w-[200px]">{p.email}</span>
            </div>
          )}
          {p.mobile && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="size-3" />
              {p.mobile}
            </div>
          )}
          {!p.email && !p.mobile && <span className="text-xs text-muted-foreground">-</span>}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="text-xs space-y-0.5">
          {p.metadata.roll_number && (
            <div className="flex items-center gap-1.5">
              <Hash className="size-3 text-muted-foreground" />
              {p.metadata.roll_number}
            </div>
          )}
          {p.metadata.seat_number && (
            <div className="flex items-center gap-1.5">
              <Armchair className="size-3 text-muted-foreground" />
              {p.metadata.seat_number}
            </div>
          )}
          {!p.metadata.roll_number && !p.metadata.seat_number && (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
        {p.metadata.organization || "-"}
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-1">
          <ParticipantDialog
            title="Edit participant"
            submitLabel="Save changes"
            initial={draftFromParticipant(p)}
            onSubmit={(d) => onUpdate(p.id, d)}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-4" />
              </Button>
            }
          />
          <DeleteParticipantButton p={p} onConfirm={onDelete} />
        </div>
      </TableCell>
    </TableRow>
  );
}
