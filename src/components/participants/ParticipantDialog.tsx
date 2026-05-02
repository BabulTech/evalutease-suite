import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { emptyDraft, validateDraft, type ParticipantDraft } from "./types";

type Props = {
  trigger: ReactNode;
  initial?: ParticipantDraft;
  title: string;
  description?: string;
  submitLabel?: string;
  onSubmit: (draft: ParticipantDraft) => Promise<void>;
};

export function ParticipantDialog({
  trigger,
  initial,
  title,
  description,
  submitLabel = "Save",
  onSubmit,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ParticipantDraft>(() => initial ?? emptyDraft());
  const [busy, setBusy] = useState(false);

  const handleOpen = (o: boolean) => {
    setOpen(o);
    if (o) setDraft(initial ?? emptyDraft());
  };

  const set = <K extends keyof ParticipantDraft>(key: K, value: ParticipantDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    const v = validateDraft(draft);
    if (!v.ok) {
      toast.error(v.reason);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(draft);
      setOpen(false);
    } catch {
      // onSubmit reports its own error toast; just stay open
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label className="mb-1.5">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Full name"
              autoFocus
            />
          </div>
          <div>
            <Label className="mb-1.5">Email</Label>
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="student@example.com"
            />
          </div>
          <div>
            <Label className="mb-1.5">Contact number</Label>
            <Input
              type="tel"
              value={draft.mobile}
              onChange={(e) => set("mobile", e.target.value)}
              placeholder="+92 300 0000000"
            />
          </div>
          <div>
            <Label className="mb-1.5">Roll number</Label>
            <Input
              value={draft.roll_number}
              onChange={(e) => set("roll_number", e.target.value)}
              placeholder="2026-CS-042"
            />
          </div>
          <div>
            <Label className="mb-1.5">Seat number</Label>
            <Input
              value={draft.seat_number}
              onChange={(e) => set("seat_number", e.target.value)}
              placeholder="A-12"
            />
          </div>
          <div>
            <Label className="mb-1.5">Organization / school</Label>
            <Input
              value={draft.organization}
              onChange={(e) => set("organization", e.target.value)}
              placeholder="Babul Academy"
            />
          </div>
          <div>
            <Label className="mb-1.5">Class / grade</Label>
            <Input
              value={draft.class}
              onChange={(e) => set("class", e.target.value)}
              placeholder="Class 10 / Year 12"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5">Address</Label>
            <Input value={draft.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="mb-1.5">Notes</Label>
            <Textarea
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Anything worth remembering about this participant"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {busy ? "Saving…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
