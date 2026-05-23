import { type ParticipantDraft } from "./types";
import { DraftRow } from "./draft-review/DraftRow";

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
          <DraftRow
            key={`${i}-${d.name}`}
            draft={d}
            onChange={(patch) => update(i, patch)}
            onRemove={() => remove(i)}
          />
        ))}
      </ul>
    </div>
  );
}
