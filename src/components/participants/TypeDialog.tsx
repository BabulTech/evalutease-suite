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
import type { IconKey } from "@/components/categories/icons";
import { IconPicker } from "./type-dialog/IconPicker";

export type TypeDraft = { name: string; icon: IconKey };

type Props = {
  trigger: ReactNode;
  initial?: TypeDraft;
  title: string;
  submitLabel?: string;
  onSubmit: (draft: TypeDraft) => Promise<void>;
};

export function TypeDialog({ trigger, initial, title, submitLabel = "Save", onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState<IconKey>(initial?.icon ?? "person");
  const [busy, setBusy] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setName(initial?.name ?? "");
      setIcon(initial?.icon ?? "person");
    }
    setOpen(next);
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name is required");
      return;
    }
    if (trimmed.length > 80) {
      toast.error("Name must be ≤ 80 characters");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ name: trimmed, icon });
      setOpen(false);
    } catch {
      // onSubmit shows its own toast
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Participant types group your roster - students, teachers, partners, etc.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Student, Teacher, Colleague, Partner"
              maxLength={80}
            />
          </div>
          <div>
            <Label className="mb-1.5">Icon</Label>
            <IconPicker value={icon} onChange={setIcon} />
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
