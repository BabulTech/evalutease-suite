import { useEffect, useState } from "react";
import { validationError } from "@/components/ui/validation-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function EditSessionDialog({
  open,
  onOpenChange,
  initialTitle,
  initialTime,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTitle: string;
  initialTime: number;
  onSave: (title: string, time: number) => Promise<void>;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [time, setTime] = useState(String(initialTime));
  const [busy, setBusy] = useState(false);

  // react-doctor-disable-next-line react-doctor/no-event-handler
  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-event-handler
    if (open) {
      setTitle(initialTitle);
      // react-doctor-disable-next-line react-doctor/no-derived-state
      setTime(String(initialTime));
    }
  }, [open, initialTitle, initialTime]);

  const submit = async () => {
    const t = title.trim();
    if (!t) {
      validationError("Title is required");
      return;
    }
    const n = Number(time);
    if (!Number.isFinite(n) || n < 5 || n > 3600) {
      validationError("Time must be between 5 and 3600 seconds");
      return;
    }
    setBusy(true);
    try {
      await onSave(t, n);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit quiz</DialogTitle>
          <DialogDescription>
            Update the title or time-per-question for this session.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label className="mb-1.5">Time per question (seconds)</Label>
            <Input
              type="number"
              min={5}
              max={3600}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
