import { useState } from "react";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleSlash,
  Loader2,
  MessageSquare,
  Minus,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { buildCriteriaNote, verdictColor, verdictPoints } from "./types";
import type {
  AiCriteria,
  AiResult,
  AiRowState,
  GradeAnswer,
  GradeVerdict,
  RowGrade,
} from "./types";

type AnswerRowProps = {
  answer: GradeAnswer;
  index: number;
  grade: RowGrade;
  onGradeChange: (g: RowGrade) => void;
  saving: boolean;
  onGraded: (answerId: string, points: number, comment: string) => Promise<void>;
  onRunAi: (answer: GradeAnswer, criteriaNote: string) => Promise<AiResult>;
  creditCost: number;
  canAffordAi: boolean;
  isUnlocked: boolean;
  onEditGrade: () => void;
};

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function AnswerRow({
  answer,
  index,
  grade,
  onGradeChange,
  saving,
  onGraded,
  onRunAi,
  creditCost,
  canAffordAi,
  isUnlocked,
  onEditGrade,
}: AnswerRowProps) {
  const saved = answer.graded_at !== null && !isUnlocked;
  const { verdict, customPoints, comment, showComment } = grade;
  const [showAnswer, setShowAnswer] = useState(true);
  const [aiState, setAiState] = useState<AiRowState>("idle");
  const [aiCriteria, setAiCriteria] = useState<AiCriteria>({
    concepts: true,
    grammar: false,
    spelling: false,
    relevance: true,
    custom: "",
  });
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [aiPoints, setAiPoints] = useState<number>(0);
  const [aiComment, setAiComment] = useState("");
  const [aiSaving, setAiSaving] = useState(false);

  const saveOne = async (pts: number, msg: string) => {
    setAiSaving(true);
    try {
      await supabase
        .from("quiz_answers")
        .update({
          points_awarded: pts,
          grader_comment: msg.trim() || null,
          graded_at: new Date().toISOString(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .eq("id", answer.id);
      const { data: ptRows } = await supabase
        .from("quiz_answers")
        .select("points_awarded")
        .eq("attempt_id", answer.attempt_id);
      const newScore = (ptRows ?? []).reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s, r) => s + (((r as any).points_awarded as number) ?? 0),
        0,
      );
      await supabase.from("quiz_attempts").update({ score: newScore }).eq("id", answer.attempt_id);
      await onGraded(answer.id, pts, msg.trim());
      toast.success(`Answer ${index + 1} graded ✓`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAiSaving(false);
    }
  };

  const runAi = async () => {
    setAiState("running");
    try {
      const result = await onRunAi(answer, buildCriteriaNote(aiCriteria));
      setAiResult(result);
      setAiPoints(result.points);
      setAiComment(result.comment);
      setAiState("review");
    } catch (err) {
      toast.error((err as Error).message);
      setAiState("criteria");
    }
  };

  const isBusy = saving || aiSaving;

  return (
    <div
      className={`rounded-2xl border p-5 space-y-4 transition-all ${saved ? "border-success/30 bg-success/5" : "border-border bg-card/60"}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Answer #{index + 1}
        </span>
        {saved && (
          <Badge className="bg-success/15 text-success border-0 text-xs gap-1">
            <CheckCircle2 className="size-3" /> Graded · {answer.points_awarded ?? 0}/
            {answer.max_points} pts
          </Badge>
        )}
      </div>

      <button type="button" onClick={() => setShowAnswer((p) => !p)} className="w-full text-left">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-1">
          {showAnswer ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          {showAnswer ? "Hide answer" : "Show student answer"}
        </div>
      </button>
      {showAnswer && (
        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed">
          {answer.answer_text?.trim() || (
            <span className="italic text-muted-foreground">No answer submitted</span>
          )}
        </div>
      )}

      {saved && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            {answer.grader_comment && <p className="mt-1 italic">"{answer.grader_comment}"</p>}
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onEditGrade}
              className="gap-1.5 h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-3" /> Edit grade
            </Button>
          </div>
        </div>
      )}

      {!saved && aiState === "idle" && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {(["correct", "partial", "wrong"] as GradeVerdict[]).map((v) => {
              const active = verdict === v;
              const icons = {
                correct: <Check className="size-4" />,
                partial: <Minus className="size-4" />,
                wrong: <CircleSlash className="size-4" />,
              };
              const labels = {
                correct: `Correct (${answer.max_points}pts)`,
                partial: `Partial (${verdictPoints("partial", answer.max_points)}pts)`,
                wrong: "Wrong (0pts)",
              };
              return (
                <button
                  key={v}
                  type="button"
                  disabled={isBusy}
                  onClick={() => onGradeChange({ ...grade, verdict: v, customPoints: null })}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all ${active ? verdictColor(v) : "border-border bg-card/40 text-muted-foreground hover:border-primary/40"} ${isBusy ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  {icons[v]}
                  <span className="hidden sm:inline">{labels[v]}</span>
                  <span className="sm:hidden capitalize">{v}</span>
                </button>
              );
            })}
          </div>

          {verdict && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground shrink-0">Points:</span>
              <input
                type="number"
                aria-label="Custom points"
                min={0}
                max={answer.max_points}
                value={customPoints ?? verdictPoints(verdict, answer.max_points)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n) && n >= 0 && n <= answer.max_points)
                    onGradeChange({ ...grade, customPoints: n });
                }}
                disabled={isBusy}
                className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              />
              <span className="text-xs text-muted-foreground">/ {answer.max_points}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => onGradeChange({ ...grade, showComment: !showComment })}
            disabled={isBusy}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <MessageSquare className="size-3.5" />
            {showComment ? "Hide comment" : "Add comment (optional)"}
          </button>
          {showComment && (
            <Textarea
              value={comment}
              onChange={(e) => onGradeChange({ ...grade, comment: e.target.value })}
              placeholder="Feedback for the student…"
              rows={2}
              disabled={isBusy}
              className="resize-none text-sm"
            />
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAiState("criteria")}
              disabled={isBusy || !canAffordAi}
              title={
                !canAffordAi
                  ? "Not enough credits"
                  : `Grade this answer with AI (${creditCost} credit)`
              }
              className="gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
            >
              <Sparkles className="size-4" />
              <span className="hidden sm:inline">Check with AI</span>
            </Button>
          </div>
        </>
      )}

      {!saved && aiState === "criteria" && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Set Marking Criteria</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI will grade this answer ({answer.max_points} pts max) based on your criteria.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAiState("idle")}
              aria-label="Cancel AI grading"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="space-y-2.5">
            {(
              [
                {
                  key: "concepts",
                  label: "Concepts & Key Ideas",
                  desc: "Answer covers the main concepts",
                },
                {
                  key: "relevance",
                  label: "Relevance",
                  desc: "Answer is relevant to the question",
                },
                { key: "grammar", label: "Grammar", desc: "Grammatically correct" },
                { key: "spelling", label: "Spelling", desc: "Words are spelled correctly" },
              ] as { key: keyof AiCriteria; label: string; desc: string }[]
            ).map(({ key, label, desc }) => (
              <label
                key={key}
                htmlFor={`ai-crit-${key}`}
                className="flex items-start gap-3 cursor-pointer"
              >
                <Checkbox
                  id={`ai-crit-${key}`}
                  checked={aiCriteria[key] as boolean}
                  onCheckedChange={(v) => setAiCriteria((c) => ({ ...c, [key]: !!v }))}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
              </label>
            ))}
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
              Additional Instructions (optional)
            </span>
            <Textarea
              placeholder="e.g. Must mention specific terminology, award marks for structure…"
              value={aiCriteria.custom}
              onChange={(e) => setAiCriteria((c) => ({ ...c, custom: e.target.value }))}
              rows={2}
              className="resize-none text-sm"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-xl px-3 py-2">
            <span>
              Cost: <span className="font-semibold text-primary">{creditCost} credit</span>
            </span>
            <span>
              Max marks: <span className="font-semibold">{answer.max_points} pts</span>
            </span>
          </div>
          <Button
            onClick={() => void runAi()}
            disabled={!Object.values(aiCriteria).some(Boolean)}
            className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Sparkles className="size-4" /> Run AI Grading
          </Button>
        </div>
      )}

      {!saved && aiState === "running" && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 flex flex-col items-center gap-3">
          <div className="size-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Sparkles className="size-6 text-primary-foreground animate-pulse" />
          </div>
          <p className="text-sm font-medium">AI is grading this answer…</p>
          <p className="text-xs text-muted-foreground">Usually takes 2–5 seconds</p>
        </div>
      )}

      {!saved && aiState === "review" && aiResult && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h3 className="font-semibold text-sm">AI Suggestion</h3>
            </div>
            <button
              type="button"
              onClick={() => setAiState("idle")}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="size-3" /> Grade manually instead
            </button>
          </div>
          <div className="rounded-xl border border-border bg-card/60 px-4 py-3 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              AI Reasoning
            </div>
            <p className="text-sm text-foreground">{aiResult.reasoning}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-1.5">Points to award</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAiPoints((p) => Math.max(0, p - 1))}
                  disabled={saving}
                  className="size-8 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center text-lg font-bold disabled:opacity-40"
                >
                  −
                </button>
                <input
                  type="number"
                  aria-label="Points to award"
                  min={0}
                  max={answer.max_points}
                  value={aiPoints}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n >= 0 && n <= answer.max_points) setAiPoints(n);
                  }}
                  disabled={saving}
                  className="w-20 rounded-lg border border-primary/40 bg-background px-2 py-1.5 text-center text-base font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setAiPoints((p) => Math.min(answer.max_points, p + 1))}
                  disabled={saving}
                  className="size-8 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center text-lg font-bold disabled:opacity-40"
                >
                  +
                </button>
                <span className="text-sm text-muted-foreground">/ {answer.max_points} pts</span>
                <span
                  className={`ml-auto text-sm font-bold ${aiPoints === answer.max_points ? "text-success" : aiPoints === 0 ? "text-destructive" : "text-warning"}`}
                >
                  {answer.max_points > 0 ? Math.round((aiPoints / answer.max_points) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block mb-1.5">
              Comment for student (editable)
            </span>
            <Textarea
              value={aiComment}
              onChange={(e) => setAiComment(e.target.value)}
              rows={2}
              disabled={aiSaving}
              className="resize-none text-sm"
            />
          </div>
          <Button
            onClick={() => void saveOne(aiPoints, aiComment)}
            disabled={aiSaving}
            className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {aiSaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {aiSaving ? "Saving…" : `Confirm, ${aiPoints}/${answer.max_points} pts`}
          </Button>
        </div>
      )}
    </div>
  );
}
