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
          {/* Participant type */}
          <div className="md:col-span-2">
            <Label className="mb-1.5">Participant type</Label>
            <Select
              value={ptype || "__none__"}
              onValueChange={(v) => set("participant_type", v === "__none__" ? "" : v as ParticipantType)}
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

          {/* Name - always required */}
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

          {/* Email + Mobile - always shown */}
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

          {/* ── Student fields ── */}
          {(ptype === "student" || ptype === "") && (
            <>
              <div>
                <Label className="mb-1.5">School / Organization</Label>
                <Input
                  value={draft.organization}
                  onChange={(e) => set("organization", e.target.value)}
                  placeholder="Babul Academy"
                />
              </div>
              <div>
                <Label className="mb-1.5">Class / Grade</Label>
                <Input
                  value={draft.grade || draft.class}
                  onChange={(e) => {
                    set("grade", e.target.value);
                    set("class", e.target.value);
                  }}
                  placeholder="Class 10 / Year 12"
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
            </>
          )}

          {/* ── Teacher fields ── */}
          {ptype === "teacher" && (
            <>
              <div>
                <Label className="mb-1.5">Employee ID</Label>
                <Input
                  value={draft.employee_id}
                  onChange={(e) => set("employee_id", e.target.value)}
                  placeholder="EMP-1234"
                />
              </div>
              <div>
                <Label className="mb-1.5">School / Institution</Label>
                <Input
                  value={draft.organization}
                  onChange={(e) => set("organization", e.target.value)}
                  placeholder="Babul Academy"
                />
              </div>
              <div>
                <Label className="mb-1.5">Subject / Class</Label>
                <Input
                  value={draft.class}
                  onChange={(e) => set("class", e.target.value)}
                  placeholder="Mathematics, Class 9–10"
                />
              </div>
            </>
          )}

          {/* ── Employee fields ── */}
          {ptype === "employee" && (
            <>
              <div>
                <Label className="mb-1.5">Employee ID</Label>
                <Input
                  value={draft.employee_id}
                  onChange={(e) => set("employee_id", e.target.value)}
                  placeholder="EMP-1234"
                />
              </div>
              <div>
                <Label className="mb-1.5">Organization / Company</Label>
                <Input
                  value={draft.organization}
                  onChange={(e) => set("organization", e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <Label className="mb-1.5">Department</Label>
                <Input
                  value={draft.department}
                  onChange={(e) => set("department", e.target.value)}
                  placeholder="Engineering"
                />
              </div>
            </>
          )}

          {/* ── Fun / Guest fields ── */}
          {ptype === "fun" && (
            <div>
              <Label className="mb-1.5">Nickname / Alias</Label>
              <Input
                value={draft.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="e.g. QuizMaster99"
              />
            </div>
          )}

          {/* Address - shown for student/teacher/employee/unset */}
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

          {/* Notes - shown for non-fun (fun reuses notes for alias) */}
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
