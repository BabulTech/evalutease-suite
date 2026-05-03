import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  PARTICIPANT_NAME_MAX,
  type ParticipantDraft,
} from "./types";

type Props = {
  drafts: ParticipantDraft[];
  setDrafts: (next: ParticipantDraft[]) => void;
};

export function ParticipantDraftReview({ drafts, setDrafts }: Props) {
  const update = (i: number, patch: Partial<ParticipantDraft>) => {
    const arr = [...drafts];
    arr[i] = { ...arr[i], ...patch };
    setDrafts(arr);
  };
  const remove = (i: number) => setDrafts(drafts.filter((_, idx) => idx !== i));

  if (drafts.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {drafts.length} participant{drafts.length === 1 ? "" : "s"} to review
      </div>
      <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {drafts.map((d, i) => (
          <li
            key={i}
            className="rounded-xl border border-border bg-card/40 p-3 grid gap-2 sm:grid-cols-2"
          >
            <div className="sm:col-span-2 flex items-start justify-between gap-2">
              <div className="flex-1">
                <Label className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={d.name}
                  onChange={(e) => update(i, { name: e.target.value.slice(0, PARTICIPANT_NAME_MAX) })}
                  placeholder="Full name"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(i)}
                className="text-muted-foreground hover:text-destructive mt-5"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <Label className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                type="email"
                value={d.email}
                onChange={(e) => update(i, { email: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Mobile
              </Label>
              <Input value={d.mobile} onChange={(e) => update(i, { mobile: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Roll number
              </Label>
              <Input
                value={d.roll_number}
                onChange={(e) => update(i, { roll_number: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Class / grade
              </Label>
              <Input value={d.class} onChange={(e) => update(i, { class: e.target.value })} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
