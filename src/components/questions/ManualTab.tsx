import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DraftEditor } from "./DraftEditor";
import { emptyDraft, validateDraft, type DraftQuestion } from "./types";

type Props = {
  disabled?: boolean;
  onSave: (drafts: DraftQuestion[]) => Promise<void>;
};

export function ManualTab({ disabled, onSave }: Props) {
  const [draft, setDraft] = useState<DraftQuestion>(() => emptyDraft());
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const v = validateDraft(draft);
    if (!v.ok) {
      toast.error(v.reason);
      return;
    }
    setSaving(true);
    try {
      await onSave([draft]);
      setDraft(emptyDraft());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card/30 px-4 py-3 text-sm text-muted-foreground">
        Build a single MCQ. Question text is capped at{" "}
        <span className="font-semibold text-foreground">250 characters</span>. Select the correct
        option by clicking its letter circle.
      </div>

      <DraftEditor draft={draft} onChange={setDraft} />

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setDraft(emptyDraft())}
          disabled={saving}
        >
          Reset
        </Button>
        <Button
          type="button"
          onClick={submit}
          disabled={disabled || saving}
          className="bg-gradient-primary text-primary-foreground shadow-glow"
        >
          <Plus className="h-4 w-4 mr-1" />
          {saving ? "Saving…" : "Add question"}
        </Button>
      </div>
    </div>
  );
}
