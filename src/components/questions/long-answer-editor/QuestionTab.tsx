import { BookOpen } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { type LongAnswerDraft, MAX_QUESTION_LENGTH } from "../types";

type Props = { draft: LongAnswerDraft; onChange: (next: LongAnswerDraft) => void };

export function QuestionTab({ draft, onChange }: Props) {
  const overLimit = draft.text.length > MAX_QUESTION_LENGTH;
  return (
    <TabsContent value="question" className="space-y-3 pt-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Question stem
          </Label>
          <span
            className={`text-xs font-medium ${overLimit ? "text-destructive" : "text-muted-foreground"}`}
          >
            {draft.text.length}/{MAX_QUESTION_LENGTH}
          </span>
        </div>
        <Textarea
          value={draft.text}
          onChange={(e) =>
            onChange({ ...draft, text: e.target.value.slice(0, MAX_QUESTION_LENGTH) })
          }
          placeholder="Ask an essay question, e.g. 'Explain the causes of World War I in detail.'"
          maxLength={MAX_QUESTION_LENGTH}
          className="min-h-[120px] resize-none"
        />
      </div>
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary flex items-start gap-2">
        <BookOpen className="size-4 shrink-0 mt-0.5" />
        <span>
          Long answers are graded after the quiz ends. You can choose AI grading (uses credits) or
          grade manually, the option appears when the quiz completes.
        </span>
      </div>
    </TabsContent>
  );
}
