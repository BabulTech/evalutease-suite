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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { emptyDraft, validateDraft, type ParticipantDraft, type ParticipantType } from "./types";
import { StudentFields } from "./participant-dialog/StudentFields";
import { TeacherFields } from "./participant-dialog/TeacherFields";
import { EmployeeFields } from "./participant-dialog/EmployeeFields";
import { FunGuestFields } from "./participant-dialog/FunGuestFields";

type Props = {
  trigger: ReactNode;
  initial?: ParticipantDraft;
  title: string;
  description?: string;
  submitLabel?: string;
  onSubmit: (draft: ParticipantDraft) => Promise<void>;
};

const TYPE_OPTIONS: { value: ParticipantType; label: string; emoji: string }[] = [
  { value: "student", label: "Student", emoji: "🎓" },
  { value: "teacher", label: "Teacher", emoji: "📚" },
  { value: "employee", label: "Employee", emoji: "💼" },
  { value: "fun", label: "Fun / Guest", emoji: "🎉" },
];

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
      // onSubmit reports its own error toast
    } finally {
      setBusy(false);
    }
  };

  const ptype = draft.participant_type;

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
            <Label className="mb-1.5">Participant type</Label>
            <Select
              value={ptype || "__none__"}
              onValueChange={(v) =>
                set("participant_type", v === "__none__" ? "" : (v as ParticipantType))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">- Not specified -</SelectItem>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.emoji} {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label className="mb-1.5">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Full name"
            />
          </div>

          <div>
            <Label className="mb-1.5">Email</Label>
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="participant@example.com"
            />
          </div>
          <div>
            <Label className="mb-1.5">Mobile</Label>
            <Input
              type="tel"
              value={draft.mobile}
              onChange={(e) => set("mobile", e.target.value)}
              placeholder="+92 300 0000000"
            />
          </div>

          {(ptype === "student" || ptype === "") && <StudentFields draft={draft} set={set} />}
          {ptype === "teacher" && <TeacherFields draft={draft} set={set} />}
          {ptype === "employee" && <EmployeeFields draft={draft} set={set} />}
          {ptype === "fun" && <FunGuestFields draft={draft} set={set} />}

          {ptype !== "fun" && (
            <div className="md:col-span-2">
              <Label className="mb-1.5">Address</Label>
              <Input
                value={draft.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="City / Area"
              />
            </div>
          )}

          {ptype !== "fun" && (
            <div className="md:col-span-2">
              <Label className="mb-1.5">Notes</Label>
              <Textarea
                value={draft.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Anything worth remembering"
                rows={2}
              />
            </div>
          )}
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
