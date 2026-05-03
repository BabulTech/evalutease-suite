import { useEffect, useState, type ReactNode } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type SubTypeDraft = { name: string; description: string };

type Props = {
  trigger: ReactNode;
  initial?: SubTypeDraft;
  title: string;
  description?: string;
  submitLabel?: string;
  onSubmit: (draft: SubTypeDraft) => Promise<void>;
};

export function SubTypeDialog({
  trigger,
  initial,
  title,
  description = "Sub-types break down a type — e.g. 'Class 9' / 'Class 10' under Student.",
  submitLabel = "Save",
  onSubmit,
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setDesc(initial?.description ?? "");
    }
  }, [open, initial]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name is required");
      return;
    }
    if (trimmed.length > 120) {
      toast.error("Name must be ≤ 120 characters");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ name: trimmed, description: desc.trim() });
      setOpen(false);
    } catch {
      // onSubmit shows its own toast
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5">Name</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Class 9, Engineering, Section A"
              maxLength={120}
            />
          </div>
          <div>
            <Label className="mb-1.5">Description (optional)</Label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="A short note for yourself"
              rows={3}
              maxLength={500}
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
