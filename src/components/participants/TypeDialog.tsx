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
import { Button } from "@/components/ui/button";
import { PARTICIPANT_TYPE_ICONS, type IconKey } from "@/components/categories/icons";

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

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setIcon(initial?.icon ?? "person");
    }
  }, [open, initial]);

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
    <Dialog open={open} onOpenChange={setOpen}>
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
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Student, Teacher, Colleague, Partner"
              maxLength={80}
            />
          </div>
          <div>
            <Label className="mb-1.5">Icon</Label>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {PARTICIPANT_TYPE_ICONS.map((ic) => {
                const Icon = ic.icon;
                const active = icon === ic.key;
                return (
                  <button
                    key={ic.key}
                    type="button"
                    onClick={() => setIcon(ic.key)}
                    title={ic.label}
                    className={`aspect-square rounded-xl border flex items-center justify-center transition-all ${
                      active
                        ? "border-primary/60 bg-primary/15 shadow-glow text-primary"
                        : "border-border bg-card/40 hover:border-primary/30 text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
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
