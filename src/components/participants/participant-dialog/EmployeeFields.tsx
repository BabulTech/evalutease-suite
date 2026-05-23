import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParticipantDraft } from "../types";

type Props = {
  draft: ParticipantDraft;
  set: <K extends keyof ParticipantDraft>(key: K, value: ParticipantDraft[K]) => void;
};

export function EmployeeFields({ draft, set }: Props) {
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
  );
}
