import { Trash2, FileText, BookOpen, Settings2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import { type LongAnswerDraft } from "./types";
import { QuestionTab } from "./long-answer-editor/QuestionTab";
import { AnswerKeyTab } from "./long-answer-editor/AnswerKeyTab";
import { SettingsTab } from "./long-answer-editor/SettingsTab";

type Props = {
  draft: LongAnswerDraft;
  index?: number;
  onChange: (next: LongAnswerDraft) => void;
  onRemove?: () => void;
  compact?: boolean;
};

export function LongAnswerEditor({ draft, index, onChange, onRemove, compact }: Props) {
  const { t } = useI18n();

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          {typeof index === "number" ? `${t("q.question")} ${index + 1}` : t("q.question")}
          <span className="ml-2 text-[10px] font-bold text-primary">· LONG ANSWER</span>
        </Label>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      <Tabs defaultValue="question" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="question" className="gap-1.5">
            <FileText className="size-3.5" /> Question
          </TabsTrigger>
          <TabsTrigger value="answer" className="gap-1.5">
            <BookOpen className="size-3.5" /> Answer Key
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5" disabled={compact}>
            <Settings2 className="size-3.5" /> Settings
          </TabsTrigger>
        </TabsList>

        <QuestionTab draft={draft} onChange={onChange} />
        <AnswerKeyTab draft={draft} onChange={onChange} />
        <SettingsTab draft={draft} onChange={onChange} compact={compact} />
      </Tabs>
    </div>
  );
}
