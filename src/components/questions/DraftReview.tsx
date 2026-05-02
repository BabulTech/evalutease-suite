import { useState } from "react";
import { toast } from "sonner";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DraftEditor } from "./DraftEditor";
import { validateDraft, type DraftQuestion, type QuestionSource } from "./types";

type Props = {
  drafts: DraftQuestion[];
  setDrafts: (next: DraftQuestion[]) => void;
  onSave: (drafts: DraftQuestion[]) => Promise<void>;
  onClear: () => void;
  source: QuestionSource;
  saving: boolean;
};

export function DraftReview({ drafts, setDrafts, onSave, onClear, source, saving }: Props) {
  const [submitting, setSubmitting] = useState(false);
  if (drafts.length === 0) return null;

  const updateAt = (i: number, next: DraftQuestion) => {
    const arr = [...drafts];
    arr[i] = next;
    setDrafts(arr);
  };
  const removeAt = (i: number) => {
    setDrafts(drafts.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    for (let i = 0; i < drafts.length; i++) {
      const v = validateDraft(drafts[i]);
      if (!v.ok) {
        toast.error(`Question ${i + 1}: ${v.reason}`);
        return;
      }
    }
    setSubmitting(true);
    try {
      await onSave(drafts);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <div>
          <div className="text-sm font-semibold">
            {drafts.length} draft {drafts.length === 1 ? "question" : "questions"} ready
          </div>
          <div className="text-xs text-muted-foreground">
            Review and edit each one, then save them all to the selected category. Source will be
            marked as
            <span className="ml-1 font-mono">{source}</span>.
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={submitting || saving}
          >
            <X className="h-4 w-4 mr-1" /> Discard all
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={submitting || saving}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Save className="h-4 w-4 mr-1" />
            {submitting || saving ? "Saving…" : `Save all (${drafts.length})`}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {drafts.map((d, i) => (
          <DraftEditor
            key={i}
            draft={d}
            index={i}
            onChange={(next) => updateAt(i, next)}
            onRemove={() => removeAt(i)}
          />
        ))}
      </div>
    </div>
  );
}
