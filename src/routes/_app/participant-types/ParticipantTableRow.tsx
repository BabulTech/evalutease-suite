import { useState } from "react";
import { Armchair, ChevronDown, ChevronUp, Hash, Mail, Pencil, Phone, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
        title="Delete"
      >
        <Trash2 className="size-4" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("pt.removeTitle").replace("{name}", p.name)}</AlertDialogTitle>
          <AlertDialogDescription>{t("pt.removeDesc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
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
            {busy ? t("pt.deleting") : t("common.delete")}
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
  const { t } = useI18n();
  const typeEmoji = "";

  return (
    <TableRow
      className={`cursor-pointer transition-colors min-h-[52px] ${selected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/30"}`}
      onClick={onSelect}
    >
      <TableCell className="py-3">
        <div className="flex items-center gap-2">
          {selected ? (
            <ChevronUp className="size-3.5 text-primary shrink-0" />
          ) : (
            <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
          )}
          <div>
            <div
              className={`font-medium flex items-center gap-1 text-sm ${selected ? "text-primary" : ""}`}
            >
              {typeEmoji && <span>{typeEmoji}</span>}
              {p.name}
            </div>
            {(p.metadata.class || p.metadata.grade) && (
              <div className="text-xs text-muted-foreground">
                {p.metadata.class || p.metadata.grade}
              </div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <div className="text-sm space-y-0.5">
          {p.email && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Mail className="size-3 shrink-0" />
              <span className="truncate max-w-[180px]">{p.email}</span>
            </div>
          )}
          {p.mobile && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="size-3 shrink-0" />
              {p.mobile}
            </div>
          )}
          {!p.email && !p.mobile && <span className="text-xs text-muted-foreground">-</span>}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell py-3">
        <div className="text-xs space-y-0.5">
          {p.metadata.roll_number && (
            <div className="flex items-center gap-1.5">
              <Hash className="size-3 text-muted-foreground" />
              {p.metadata.roll_number}
            </div>
          )}
          {p.metadata.employee_id && (
            <div className="flex items-center gap-1.5">
              <Hash className="size-3 text-muted-foreground" />
              {p.metadata.employee_id}
            </div>
          )}
          {p.metadata.seat_number && (
            <div className="flex items-center gap-1.5">
              <Armchair className="size-3 text-muted-foreground" />
              {p.metadata.seat_number}
            </div>
          )}
          {p.metadata.department && (
            <div className="text-muted-foreground">{p.metadata.department}</div>
          )}
          {!p.metadata.roll_number &&
            !p.metadata.employee_id &&
            !p.metadata.seat_number &&
            !p.metadata.department && <span className="text-muted-foreground">-</span>}
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground py-3">
        {p.metadata.organization || "-"}
      </TableCell>
      <TableCell className="text-right py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-1">
          <ParticipantDialog
            title={t("pt.editTitle")}
            submitLabel={t("pt.saveChanges")}
            initial={draftFromParticipant(p)}
            onSubmit={(d) => onUpdate(p.id, d)}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                title="Edit"
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
