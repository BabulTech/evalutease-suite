import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParticipantDraft } from "../types";

type Props = {
  draft: ParticipantDraft;
  set: <K extends keyof ParticipantDraft>(key: K, value: ParticipantDraft[K]) => void;
};

export function StudentFields({ draft, set }: Props) {
  return (
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
  );
}
