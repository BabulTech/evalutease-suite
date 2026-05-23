import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParticipantDraft } from "../types";

type Props = {
  draft: ParticipantDraft;
  set: <K extends keyof ParticipantDraft>(key: K, value: ParticipantDraft[K]) => void;
};

export function TeacherFields({ draft, set }: Props) {
  return (
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
  );
}
