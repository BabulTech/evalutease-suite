import { useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DraftEditorRouter } from "../DraftEditorRouter";
import { validateDraft, type DraftQuestion, type Question } from "../types";
import { questionToDraft } from "./questionToDraft";

type Props = { q: Question; onSave: (id: string, draft: DraftQuestion) => Promise<void> };

export function EditQuestionDialog({ q, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftQuestion>(() => questionToDraft(q));
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const v = validateDraft(draft);
    if (!v.ok) {
      toast.error(v.reason);
      return;
    }
    setBusy(true);
    try {
      await onSave(q.id, draft);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(questionToDraft(q));
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        title="Edit question"
      >
        <Pencil className="size-4" />
      </Button>
      <DialogContent className="max-w-2xl w-full flex flex-col" style={{ maxHeight: "90dvh" }}>
        <DialogHeader className="shrink-0">
          <DialogTitle>Edit question</DialogTitle>
          <DialogDescription className="sr-only">
            Edit question content, answer key, and settings.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          <DraftEditorRouter draft={draft} onChange={setDraft} />
        </div>
        <DialogFooter className="shrink-0 pt-3 border-t border-border">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
