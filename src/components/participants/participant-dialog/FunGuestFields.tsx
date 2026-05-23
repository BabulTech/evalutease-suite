import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ParticipantDraft } from "../types";

type Props = {
  draft: ParticipantDraft;
  set: <K extends keyof ParticipantDraft>(key: K, value: ParticipantDraft[K]) => void;
};

export function FunGuestFields({ draft, set }: Props) {
  return (
    <div>
      <Label className="mb-1.5">Nickname / Alias</Label>
      <Input
        value={draft.notes}
        onChange={(e) => set("notes", e.target.value)}
        placeholder="e.g. QuizMaster99"
      />
    </div>
  );
}
