import { Trash2, BookOpen, ListChecks, FileText, Settings2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import { type LongAnswerDraft, type Difficulty, MAX_QUESTION_LENGTH } from "./types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  draft: LongAnswerDraft;
  index?: number;
  onChange: (next: LongAnswerDraft) => void;
  onRemove?: () => void;
  compact?: boolean;
};

export function LongAnswerEditor({ draft, index, onChange, onRemove, compact }: Props) {
  const { t } = useI18n();
  const remaining = MAX_QUESTION_LENGTH - draft.text.length;
  const overLimit = remaining < 0;

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
      {/* Header row — title + remove */}
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
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Tabs defaultValue="question" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="question" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Question
          </TabsTrigger>
          <TabsTrigger value="answer" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Answer Key
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5" disabled={compact}>
            <Settings2 className="h-3.5 w-3.5" /> Settings
          </TabsTrigger>
        </TabsList>

        {/* ── Question tab ── */}
        <TabsContent value="question" className="space-y-3 pt-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Question stem</Label>
              <span className={`text-xs font-medium ${overLimit ? "text-destructive" : "text-muted-foreground"}`}>
                {draft.text.length}/{MAX_QUESTION_LENGTH}
              </span>
            </div>
            <Textarea
              value={draft.text}
              onChange={(e) => onChange({ ...draft, text: e.target.value.slice(0, MAX_QUESTION_LENGTH) })}
              placeholder="Ask an essay question, e.g. 'Explain the causes of World War I in detail.'"
              maxLength={MAX_QUESTION_LENGTH}
              className="min-h-[120px] resize-none"
            />
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary flex items-start gap-2">
            <BookOpen className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Long answers are graded after the quiz ends. You can choose AI grading (uses credits) or grade manually — the option appears when the quiz completes.</span>
          </div>
        </TabsContent>

        {/* ── Answer Key tab ── */}
        <TabsContent value="answer" className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> Model Answer
              <span className="normal-case font-normal text-muted-foreground/70">(optional — used as reference during grading)</span>
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
              <ListChecks className="h-3.5 w-3.5" /> Rubric / Grading Criteria
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

        {/* ── Settings tab ── */}
        <TabsContent value="settings" className="pt-4">
          {!compact && (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              {t("q.difficulty")}
            </Label>
            <Select
              value={draft.difficulty}
              onValueChange={(v) => onChange({ ...draft, difficulty: v as Difficulty })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">{t("q.easy")}</SelectItem>
                <SelectItem value="medium">{t("q.medium")}</SelectItem>
                <SelectItem value="hard">{t("q.hard")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              Time Limit
            </Label>
            <div className="flex items-center gap-1.5">
              <Select
                value={String(Math.floor(draft.timeSeconds / 60))}
                onValueChange={(v) => onChange({ ...draft, timeSeconds: Number(v) * 60 + (draft.timeSeconds % 60) })}
              >
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0,1,2,3,4,5,10,15,20,30,45,60].map((m) => (
                    <SelectItem key={m} value={String(m)}>{m}m</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(draft.timeSeconds % 60)}
                onValueChange={(v) => onChange({ ...draft, timeSeconds: Math.floor(draft.timeSeconds / 60) * 60 + Number(v) })}
              >
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0,15,30,45].map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}s</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">= {draft.timeSeconds}s total</p>
          </div>
          <div>
            <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              Max Points
            </Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={draft.maxPoints}
              onChange={(e) => {
                const n = Number(e.target.value);
                onChange({ ...draft, maxPoints: Number.isFinite(n) && n >= 1 ? n : 5 });
              }}
              placeholder="5"
            />
          </div>
          <div>
            <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              {t("q.explanation")}
            </Label>
            <Input
              value={draft.explanation}
              onChange={(e) => onChange({ ...draft, explanation: e.target.value })}
              placeholder={t("q.explanationPlaceholder")}
            />
          </div>
        </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
