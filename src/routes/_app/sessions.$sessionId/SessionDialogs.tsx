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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EditSessionDialog } from "./EditSessionDialog";

export function AnnounceResultsToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4 print:hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="show-results-switch" className="text-sm font-semibold">
            Announce Results After Quiz
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {checked
              ? "Participants will see their score when the quiz ends."
              : "Participants will NOT see their score. You announce results manually."}
          </p>
        </div>
        <Switch id="show-results-switch" checked={checked} onCheckedChange={onChange} />
      </div>
    </div>
  );
}

export function SessionDialogs({
  sessionTitle,
  editOpen,
  onEditOpenChange,
  initialTitle,
  initialTime,
  onSaveEdit,
  confirmDelete,
  onConfirmDeleteChange,
  confirmClose,
  onConfirmCloseChange,
  busy,
  onDelete,
  onClose,
}: {
  sessionTitle: string;
  editOpen: boolean;
  onEditOpenChange: (open: boolean) => void;
  initialTitle: string;
  initialTime: number;
  onSaveEdit: (title: string, time: number) => Promise<void>;
  confirmDelete: boolean;
  onConfirmDeleteChange: (open: boolean) => void;
  confirmClose: boolean;
  onConfirmCloseChange: (open: boolean) => void;
  busy: boolean;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <EditSessionDialog
        open={editOpen}
        onOpenChange={onEditOpenChange}
        initialTitle={initialTitle}
        initialTime={initialTime}
        onSave={onSaveEdit}
      />

      <AlertDialog open={confirmDelete} onOpenChange={onConfirmDeleteChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{sessionTitle}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The session, its question list, attempts, and answers will all be removed. This can't
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClose} onOpenChange={onConfirmCloseChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this quiz session?</AlertDialogTitle>
            <AlertDialogDescription>
              Participants who haven't submitted yet will lose their place. The session will be
              archived under Quiz History with the final results.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                onClose();
              }}
            >
              {busy ? "Closing…" : "Close session"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
