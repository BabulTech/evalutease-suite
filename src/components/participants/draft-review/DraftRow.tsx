import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PARTICIPANT_NAME_MAX, type ParticipantDraft } from "../types";

type Props = {
  draft: ParticipantDraft;
  onChange: (patch: Partial<ParticipantDraft>) => void;
  onRemove: () => void;
};

export function DraftRow({ draft, onChange, onRemove }: Props) {
  return (
    <li className="rounded-xl border border-border bg-card/40 p-3 grid gap-2 sm:grid-cols-2">
      <div className="sm:col-span-2 flex items-start justify-between gap-2">
        <div className="flex-1">
          <Label className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            value={draft.name}
            onChange={(e) => onChange({ name: e.target.value.slice(0, PARTICIPANT_NAME_MAX) })}
            placeholder="Full name"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive mt-5"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div>
        <Label className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          Email
        </Label>
        <Input
          type="email"
          value={draft.email}
          onChange={(e) => onChange({ email: e.target.value })}
        />
      </div>
      <div>
        <Label className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          Mobile
        </Label>
        <Input value={draft.mobile} onChange={(e) => onChange({ mobile: e.target.value })} />
      </div>
      <div>
        <Label className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          Roll number
        </Label>
        <Input
          value={draft.roll_number}
          onChange={(e) => onChange({ roll_number: e.target.value })}
        />
      </div>
      <div>
        <Label className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          Class / grade
        </Label>
        <Input value={draft.class} onChange={(e) => onChange({ class: e.target.value })} />
      </div>
    </li>
  );
}
