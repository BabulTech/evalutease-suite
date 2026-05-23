import { useState } from "react";
import { X, Plus, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { ShortAnswerDraft } from "../types";

type Props = { draft: ShortAnswerDraft; onChange: (next: ShortAnswerDraft) => void };

export function AcceptedAnswers({ draft, onChange }: Props) {
  const [newAnswer, setNewAnswer] = useState("");
  const answers = draft.acceptableAnswers.length === 0 ? [""] : draft.acceptableAnswers;

  const updateAt = (i: number, value: string) => {
    const next = [...answers];
    next[i] = value;
    onChange({ ...draft, acceptableAnswers: next });
  };

  const removeAt = (i: number) => {
    const next = answers.filter((_, idx) => idx !== i);
    onChange({ ...draft, acceptableAnswers: next.length === 0 ? [""] : next });
  };

  const add = () => {
    const trimmed = newAnswer.trim();
    if (!trimmed) return;
    if (answers.some((a) => a.trim().toLowerCase() === trimmed.toLowerCase())) {
      setNewAnswer("");
      return;
    }
    onChange({ ...draft, acceptableAnswers: [...answers.filter((a) => a.trim()), trimmed] });
    setNewAnswer("");
  };

  const hasAcceptable = answers.some((a) => a.trim());

  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        Accepted Answers
        <span className="ml-2 normal-case text-muted-foreground/70 font-normal">
          (optional, used for auto-matching. You can also grade manually or with AI after the quiz.)
        </span>
      </Label>
      <div className="space-y-1.5">
        {answers.map((ans, i) => (
          <div
            key={`${i}-${ans}`}
            className="flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-2"
          >
            <Input
              value={ans}
              onChange={(e) => updateAt(i, e.target.value)}
              placeholder={i === 0 ? "e.g. Islamabad" : "Another accepted answer"}
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-8"
            />
            {answers.length > 1 && (
              <button
                type="button"
                title="Remove answer"
                onClick={() => removeAt(i)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={newAnswer}
          onChange={(e) => setNewAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add another accepted answer…"
          className="h-9"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={!newAnswer.trim()}
          className="gap-1.5"
        >
          <Plus className="size-3.5" /> Add
        </Button>
      </div>
      {!hasAcceptable && (
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <AlertCircle className="size-3.5 shrink-0 mt-0.5 text-warning" />
          <span>
            No accepted answers set, grading will need to be done manually or with AI after the
            quiz.
          </span>
        </div>
      )}
    </div>
  );
}
