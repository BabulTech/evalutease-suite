import { DraftEditor } from "./DraftEditor";
import { TrueFalseEditor } from "./TrueFalseEditor";
import { ShortAnswerEditor } from "./ShortAnswerEditor";
import { LongAnswerEditor } from "./LongAnswerEditor";
import type { DraftQuestion } from "./types";

type Props = {
  draft: DraftQuestion;
  index?: number;
  onChange: (next: DraftQuestion) => void;
  onRemove?: () => void;
  compact?: boolean;
};

// Routes a draft to the correct editor based on its type.
// Phase 1: only MCQ has a real editor. Other types render a "coming soon"
// placeholder so existing flows can still display mixed drafts safely.
export function DraftEditorRouter({ draft, ...rest }: Props) {
  switch (draft.type) {
    case "mcq":
      return (
        <DraftEditor
          draft={draft}
          index={rest.index}
          onChange={(next) => rest.onChange(next)}
          onRemove={rest.onRemove}
          compact={rest.compact}
        />
      );
    case "true_false":
      return (
        <TrueFalseEditor
          draft={draft}
          index={rest.index}
          onChange={(next) => rest.onChange(next)}
          onRemove={rest.onRemove}
          compact={rest.compact}
        />
      );
    case "short_answer":
      return (
        <ShortAnswerEditor
          draft={draft}
          index={rest.index}
          onChange={(next) => rest.onChange(next)}
          onRemove={rest.onRemove}
          compact={rest.compact}
        />
      );
    case "long_answer":
      return (
        <LongAnswerEditor
          draft={draft}
          index={rest.index}
          onChange={(next) => rest.onChange(next)}
          onRemove={rest.onRemove}
          compact={rest.compact}
        />
      );
  }
}
