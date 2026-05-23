import { BookOpen, ListChecks } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { type LongAnswerDraft } from "../types";

type Props = { draft: LongAnswerDraft; onChange: (next: LongAnswerDraft) => void };

export function AnswerKeyTab({ draft, onChange }: Props) {
  return (
    <TabsContent value="answer" className="space-y-4 pt-4">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <BookOpen className="size-3.5" /> Model Answer
          <span className="normal-case font-normal text-muted-foreground/70">
            (optional, used as reference during grading)
          </span>
        </Label>
        <Textarea
          value={draft.modelAnswer}
          onChange={(e) => onChange({ ...draft, modelAnswer: e.target.value })}
          placeholder="Write an ideal answer here. Shown to graders as a reference."
          rows={5}
          className="resize-none"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <ListChecks className="size-3.5" /> Rubric / Grading Criteria
          <span className="normal-case font-normal text-muted-foreground/70">(optional)</span>
        </Label>
        <Textarea
          value={draft.rubric}
          onChange={(e) => onChange({ ...draft, rubric: e.target.value })}
          placeholder="e.g. 2 pts for identifying the main causes, 2 pts for explanation, 1 pt for examples."
          rows={4}
          className="resize-none"
        />
      </div>
    </TabsContent>
  );
}
