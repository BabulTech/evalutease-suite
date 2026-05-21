import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronUp,
  CircleSlash, Loader2, MessageSquare, Minus, PenLine, Pencil, Sparkles, Users, X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { usePlan } from "@/contexts/PlanContext";
import { gradeAnswerWithAi, gradeAllAnswersWithAi } from "@/components/grading/gradeAnswer.server";
import { LoadingOverlay, type Step } from "@/components/ui/LoadingOverlay";

export const Route = createFileRoute("/_app/sessions/$sessionId_/grade")({
  component: GradePage,
});

type QuestionType = "short_answer" | "long_answer";
type GradingMode = "auto" | "ai" | "manual";
type GradeVerdict = "correct" | "partial" | "wrong";
type PageMode = "select" | "manual" | "ai-setup" | "ai-running" | "ai-review";
type AiRowState = "idle" | "criteria" | "running" | "review";

type GradeAnswer = {
  id: string;
  answer_text: string | null;
  points_awarded: number | null;
  graded_at: string | null;
  grader_comment: string | null;
  question_id: string;
  question_text: string;
  question_type: QuestionType;
  grading_mode: GradingMode;
  max_points: number;
  model_answer: string | null;
  rubric: string | null;
  participant_name: string | null;
  attempt_id: string;
};

type QuestionGroup = {
  question_id: string;
  question_text: string;
  question_type: QuestionType;
  max_points: number;
  model_answer: string | null;
  rubric: string | null;
  answers: GradeAnswer[];
};

type AiCriteria = {
  concepts: boolean;
  grammar: boolean;
  spelling: boolean;
  relevance: boolean;
  custom: string;
};

type AiResult = { points: number; comment: string; reasoning: string };
type AiReviewItem = { answer: GradeAnswer; result: AiResult; adjustedPoints: number };

// Strip prompt-injection attempts and limit length
function sanitizeForAi(text: string, maxLen = 2000): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // control chars
    .replace(/ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/gi, "[removed]")
    .replace(/you\s+are\s+now\s+(a|an)\s+/gi, "[removed] ")
    .replace(/disregard\s+(all\s+)?(previous|prior)\s+/gi, "[removed] ")
    .replace(/system\s*prompt/gi, "[removed]")
    .replace(/jailbreak/gi, "[removed]")
    .slice(0, maxLen)
    .trim();
}

function buildCriteriaNote(c: AiCriteria) {
  return [
    c.concepts && "concepts and key ideas",
    c.relevance && "relevance to the question",
    c.grammar && "grammar",
    c.spelling && "spelling",
    c.custom.trim() && c.custom.trim(),
  ].filter(Boolean).join(", ") || "overall quality";
}

function verdictColor(v: GradeVerdict) {
  if (v === "correct") return "border-success bg-success/10 text-success";
  if (v === "partial") return "border-warning bg-warning/10 text-warning";
  return "border-destructive bg-destructive/10 text-destructive";
}

function verdictPoints(v: GradeVerdict, maxPoints: number): number {
  if (v === "correct") return maxPoints;
  if (v === "partial") return Math.max(1, Math.floor(maxPoints / 2));
  return 0;
}

// ─── Single answer grading row ────────────────────────────────────

type RowGrade = { verdict: GradeVerdict | null; customPoints: number | null; comment: string; showComment: boolean };

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

function AnswerRow({ answer, index, grade, onGradeChange, saving, onGraded, onRunAi, creditCost, canAffordAi, isUnlocked, onEditGrade }: AnswerRowProps) {
  const saved = answer.graded_at !== null && !isUnlocked;
  const { verdict, customPoints, comment, showComment } = grade;
  const [showAnswer, setShowAnswer] = useState(true);

  // AI grading state (stays local — AI is per-answer)
  const [aiState, setAiState] = useState<AiRowState>("idle");
  const [aiCriteria, setAiCriteria] = useState<AiCriteria>({
    concepts: true, grammar: false, spelling: false, relevance: true, custom: "",
  });
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [aiPoints, setAiPoints] = useState<number>(0);
  const [aiComment, setAiComment] = useState("");
  const [aiSaving, setAiSaving] = useState(false);

  const saveOne = async (pts: number, msg: string) => {
    setAiSaving(true);
    try {
      await supabase.from("quiz_answers").update({
        points_awarded: pts,
        grader_comment: msg.trim() || null,
        graded_at: new Date().toISOString(),
      } as any).eq("id", answer.id);

      const { data: ptRows } = await supabase.from("quiz_answers").select("points_awarded").eq("attempt_id", answer.attempt_id);
      const newScore = (ptRows ?? []).reduce((s, r) => s + (((r as any).points_awarded as number) ?? 0), 0);
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

  const confirmAi = () => { void saveOne(aiPoints, aiComment); };

  const isBusy = saving || aiSaving;

  return (
    <div className={`rounded-2xl border p-5 space-y-4 transition-all ${saved ? "border-success/30 bg-success/5" : "border-border bg-card/60"}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Answer #{index + 1}</span>
        {saved && (
          <Badge className="bg-success/15 text-success border-0 text-xs gap-1">
            <CheckCircle2 className="h-3 w-3" /> Graded · {answer.points_awarded ?? 0}/{answer.max_points} pts
          </Badge>
        )}
      </div>

      {/* Student answer */}
      <button type="button" onClick={() => setShowAnswer((p) => !p)} className="w-full text-left">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-1">
          {showAnswer ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {showAnswer ? "Hide answer" : "Show student answer"}
        </div>
      </button>
      {showAnswer && (
        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed">
          {answer.answer_text?.trim() || <span className="italic text-muted-foreground">No answer submitted</span>}
        </div>
      )}

      {/* ── Saved state ── */}
      {saved && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            {answer.grader_comment && (
              <p className="mt-1 italic">"{answer.grader_comment}"</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={onEditGrade}
              className="gap-1.5 h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
              <Pencil className="h-3 w-3" />
              Edit grade
            </Button>
          </div>
        </div>
      )}

      {/* ── Grading controls (not yet saved) ── */}
      {!saved && aiState === "idle" && (
        <>
          {/* Verdict buttons */}
          <div className="grid grid-cols-3 gap-2">
            {(["correct", "partial", "wrong"] as GradeVerdict[]).map((v) => {
              const active = verdict === v;
              const icons = { correct: <Check className="h-4 w-4" />, partial: <Minus className="h-4 w-4" />, wrong: <CircleSlash className="h-4 w-4" /> };
              const labels = { correct: `Correct (${answer.max_points}pts)`, partial: `Partial (${verdictPoints("partial", answer.max_points)}pts)`, wrong: "Wrong (0pts)" };
              return (
                <button
                  key={v} type="button" disabled={isBusy}
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
                type="number" aria-label="Custom points" min={0} max={answer.max_points}
                value={customPoints ?? verdictPoints(verdict, answer.max_points)}
                onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 0 && n <= answer.max_points) onGradeChange({ ...grade, customPoints: n }); }}
                disabled={isBusy}
                className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              />
              <span className="text-xs text-muted-foreground">/ {answer.max_points}</span>
            </div>
          )}

          <button type="button" onClick={() => onGradeChange({ ...grade, showComment: !showComment })} disabled={isBusy}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            {showComment ? "Hide comment" : "Add comment (optional)"}
          </button>

          {showComment && (
            <Textarea value={comment} onChange={(e) => onGradeChange({ ...grade, comment: e.target.value })}
              placeholder="Feedback for the student…" rows={2} disabled={isBusy} className="resize-none text-sm" />
          )}

          {/* AI button only — Save Grade moved to question-level "Save All" */}
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => setAiState("criteria")}
              disabled={isBusy || !canAffordAi}
              title={!canAffordAi ? "Not enough credits" : `Grade this answer with AI (${creditCost} credit)`}
              className="gap-1.5 border-primary/40 text-primary hover:bg-primary/5">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Check with AI</span>
            </Button>
          </div>
        </>
      )}

      {/* ── AI Criteria panel ── */}
      {!saved && aiState === "criteria" && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Set Marking Criteria</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI will grade this answer ({answer.max_points} pts max) based on your criteria.
              </p>
            </div>
            <button type="button" onClick={() => setAiState("idle")} aria-label="Cancel AI grading" className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            {([
              { key: "concepts", label: "Concepts & Key Ideas", desc: "Answer covers the main concepts" },
              { key: "relevance", label: "Relevance", desc: "Answer is relevant to the question" },
              { key: "grammar", label: "Grammar", desc: "Grammatically correct" },
              { key: "spelling", label: "Spelling", desc: "Words are spelled correctly" },
            ] as { key: keyof AiCriteria; label: string; desc: string }[]).map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer">
                <Checkbox
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
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
              Additional Instructions (optional)
            </label>
            <Textarea
              placeholder="e.g. Must mention specific terminology, award marks for structure…"
              value={aiCriteria.custom}
              onChange={(e) => setAiCriteria((c) => ({ ...c, custom: e.target.value }))}
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-xl px-3 py-2">
            <span>Cost: <span className="font-semibold text-primary">{creditCost} credit</span></span>
            <span>Max marks: <span className="font-semibold">{answer.max_points} pts</span></span>
          </div>

          <Button
            onClick={() => void runAi()}
            disabled={!Object.values(aiCriteria).some(Boolean)}
            className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Sparkles className="h-4 w-4" />
            Run AI Grading
          </Button>
        </div>
      )}

      {/* ── AI Running spinner ── */}
      {!saved && aiState === "running" && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Sparkles className="h-6 w-6 text-primary-foreground animate-pulse" />
          </div>
          <p className="text-sm font-medium">AI is grading this answer…</p>
          <p className="text-xs text-muted-foreground">Usually takes 2–5 seconds</p>
        </div>
      )}

      {/* ── AI Review: teacher confirms / adjusts ── */}
      {!saved && aiState === "review" && aiResult && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">AI Suggestion</h3>
            </div>
            <button type="button" onClick={() => setAiState("idle")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <X className="h-3 w-3" /> Grade manually instead
            </button>
          </div>

          {/* Reasoning */}
          <div className="rounded-xl border border-border bg-card/60 px-4 py-3 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">AI Reasoning</div>
            <p className="text-sm text-foreground">{aiResult.reasoning}</p>
          </div>

          {/* Points awarded */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-1.5">Points to award</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setAiPoints((p) => Math.max(0, p - 1))} disabled={saving}
                  className="h-8 w-8 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center text-lg font-bold disabled:opacity-40">−</button>
                <input
                  type="number" aria-label="Points to award" min={0} max={answer.max_points}
                  value={aiPoints}
                  onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 0 && n <= answer.max_points) setAiPoints(n); }}
                  disabled={saving}
                  className="w-20 rounded-lg border border-primary/40 bg-background px-2 py-1.5 text-center text-base font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                />
                <button type="button" onClick={() => setAiPoints((p) => Math.min(answer.max_points, p + 1))} disabled={saving}
                  className="h-8 w-8 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center text-lg font-bold disabled:opacity-40">+</button>
                <span className="text-sm text-muted-foreground">/ {answer.max_points} pts</span>
                <span className={`ml-auto text-sm font-bold ${aiPoints === answer.max_points ? "text-success" : aiPoints === 0 ? "text-destructive" : "text-warning"}`}>
                  {answer.max_points > 0 ? Math.round((aiPoints / answer.max_points) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Comment to student */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Comment for student (editable)</label>
            <Textarea
              value={aiComment}
              onChange={(e) => setAiComment(e.target.value)}
              rows={2}
              disabled={aiSaving}
              className="resize-none text-sm"
            />
          </div>

          <Button
            onClick={confirmAi}
            disabled={aiSaving}
            className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {aiSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {aiSaving ? "Saving…" : `Confirm — ${aiPoints}/${answer.max_points} pts`}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────

function GradePage() {
  const { sessionId } = Route.useParams();
  const { user } = useAuth();
  const { plan, credits, reload } = usePlan();
  const navigate = useNavigate();

  const [answers, setAnswers] = useState<GradeAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionStatus, setSessionStatus] = useState<string>("");
  const [mode, setMode] = useState<PageMode>("select");

  // Manual mode state
  const [questionIndex, setQuestionIndex] = useState(0);
  // Grade selections per answer (verdict/points/comment before bulk-save)
  const [rowGrades, setRowGrades] = useState<Record<string, RowGrade>>({});
  const [savingAll, setSavingAll] = useState(false);

  // Step-driven loading overlay state (long-running operations)
  const [overlay, setOverlay] = useState<{ visible: boolean; title: string; steps: Step[]; step: number; hint?: string }>({
    visible: false, title: "", steps: [], step: 0,
  });
  const showOverlay = (title: string, steps: Step[], hint?: string) =>
    setOverlay({ visible: true, title, steps, step: 0, hint });
  const advanceOverlay = (step: number) => setOverlay((prev) => ({ ...prev, step }));
  const finishOverlay = () => setOverlay((prev) => ({ ...prev, step: prev.steps.length }));
  const hideOverlay = () => setOverlay((prev) => ({ ...prev, visible: false }));
  // Saved answers the host has reopened for editing — treated as pending in UI
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());
  const isUnsavedForUI = (a: GradeAnswer) => a.graded_at === null || unlockedIds.has(a.id);

  const handleEditGrade = useCallback((answer: GradeAnswer) => {
    const verdict: GradeVerdict | null = answer.points_awarded == null ? null
      : answer.points_awarded === answer.max_points ? "correct"
      : answer.points_awarded === 0 ? "wrong"
      : "partial";
    setRowGrades((prev) => ({
      ...prev,
      [answer.id]: {
        verdict,
        customPoints: answer.points_awarded,
        comment: answer.grader_comment ?? "",
        showComment: !!answer.grader_comment,
      },
    }));
    setUnlockedIds((prev) => {
      const next = new Set(prev);
      next.add(answer.id);
      return next;
    });
  }, []);

  const getRowGrade = (answer: GradeAnswer): RowGrade =>
    rowGrades[answer.id] ?? {
      verdict: answer.graded_at
        ? answer.points_awarded === answer.max_points ? "correct"
          : answer.points_awarded === 0 ? "wrong" : "partial"
        : null,
      customPoints: null,
      comment: answer.grader_comment ?? "",
      showComment: false,
    };

  // AI bulk setup state
  const [criteria, setCriteria] = useState<AiCriteria>({
    concepts: true, grammar: false, spelling: false, relevance: true, custom: "",
  });
  const [aiRunning, setAiRunning] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiReviewItems, setAiReviewItems] = useState<AiReviewItem[]>([]);
  const [savingReview, setSavingReview] = useState(false);

  const creditCostShort = plan?.credit_cost_ai_grade_short ?? 1;
  const creditCostLong = plan?.credit_cost_ai_grade_long ?? 3;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sess } = await supabase.from("quiz_sessions").select("title, status").eq("id", sessionId).single();
      if (sess) { setSessionTitle(sess.title ?? "Session"); setSessionStatus(sess.status ?? ""); }

      const { data: attemptRows } = await supabase.from("quiz_attempts").select("id, participant_name").eq("session_id", sessionId);
      const attemptIds = (attemptRows ?? []).map((a) => a.id);
      const participantMap = Object.fromEntries((attemptRows ?? []).map((a) => [a.id, a.participant_name]));
      if (attemptIds.length === 0) { setAnswers([]); setLoading(false); return; }

      const { data, error } = await supabase.from("quiz_answers").select(`
        id, answer, points_awarded, graded_at, grader_comment, question_id, attempt_id,
        questions!inner(text, type, max_points, grading_mode, model_answer, rubric)
      `).in("attempt_id", attemptIds)
        .in("questions.type", ["short_answer", "long_answer"] as any)
        .order("graded_at", { ascending: true, nullsFirst: true });

      if (error) throw error;

      const rows: GradeAnswer[] = (data ?? []).map((row: any) => ({
        id: row.id,
        answer_text: row.answer,
        points_awarded: row.points_awarded,
        graded_at: row.graded_at,
        grader_comment: row.grader_comment,
        question_id: row.question_id,
        question_text: row.questions?.text ?? "",
        question_type: (row.questions?.type ?? "short_answer") as QuestionType,
        grading_mode: (row.questions?.grading_mode ?? "manual") as GradingMode,
        max_points: row.questions?.max_points ?? 1,
        model_answer: row.questions?.model_answer ?? null,
        rubric: row.questions?.rubric ?? null,
        participant_name: participantMap[row.attempt_id] ?? null,
        attempt_id: row.attempt_id,
      }));
      setAnswers(rows);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { void load(); }, [load]);

  const handleGraded = useCallback(async (answerId: string, points: number, comment: string) => {
    // Use functional setState so consecutive calls in a loop don't clobber each other
    setAnswers((prev) => prev.map((a) =>
      a.id === answerId ? { ...a, points_awarded: points, graded_at: new Date().toISOString(), grader_comment: comment || null } : a,
    ));
    setUnlockedIds((prev) => {
      if (!prev.has(answerId)) return prev;
      const next = new Set(prev);
      next.delete(answerId);
      return next;
    });
  }, []);

  const handleSaveAllGrades = useCallback(async (groupAnswers: GradeAnswer[]) => {
    const unsaved = groupAnswers.filter((a) => a.graded_at === null || unlockedIds.has(a.id));
    const missing = unsaved.filter((a) => !rowGrades[a.id]?.verdict);
    if (missing.length > 0) {
      toast.error(`Please select a verdict for all ${missing.length} remaining answer(s) before saving.`);
      return;
    }
    setSavingAll(true);
    showOverlay(
      "Saving grades",
      [
        { label: "Validating verdicts",     detail: `${unsaved.length} answer${unsaved.length === 1 ? "" : "s"} ready to save` },
        { label: "Writing grades to database", detail: "Recording points and comments for each answer…" },
        { label: "Updating participant scores", detail: "Recalculating total score per attempt…" },
      ],
      `${unsaved.length} answer${unsaved.length === 1 ? "" : "s"} to save`,
    );
    try {
      // Step 1: validation already passed
      advanceOverlay(1);
      const affectedAttempts = new Set<string>();
      for (const answer of unsaved) {
        const g = rowGrades[answer.id];
        if (!g?.verdict) continue;
        const pts = g.customPoints ?? verdictPoints(g.verdict, answer.max_points);
        const msg = g.comment.trim();
        await supabase.from("quiz_answers").update({
          points_awarded: pts,
          grader_comment: msg || null,
          graded_at: new Date().toISOString(),
        } as any).eq("id", answer.id);
        affectedAttempts.add(answer.attempt_id);
        await handleGraded(answer.id, pts, msg);
      }
      // Step 2 done → Step 3: recompute attempt scores (one query per affected attempt)
      advanceOverlay(2);
      for (const attemptId of affectedAttempts) {
        const { data: ptRows } = await supabase.from("quiz_answers").select("points_awarded").eq("attempt_id", attemptId);
        const newScore = (ptRows ?? []).reduce((s, r) => s + (((r as any).points_awarded as number) ?? 0), 0);
        await supabase.from("quiz_attempts").update({ score: newScore }).eq("id", attemptId);
      }
      finishOverlay();
      toast.success(`${unsaved.length} answer(s) saved!`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingAll(false);
      setTimeout(hideOverlay, 400);
    }
  }, [rowGrades, handleGraded, unlockedIds]);

  const [finalizing, setFinalizing] = useState(false);
  const handleFinalize = useCallback(async () => {
    setFinalizing(true);
    showOverlay(
      "Finalizing session",
      [
        { label: "Checking pending answers", detail: "Making sure every typed answer has been graded…" },
        { label: "Closing the session",      detail: "Marking the session as completed in the database…" },
        { label: "Moving to history",        detail: "Your session will appear in Quiz History." },
      ],
      "This usually takes 1–3 seconds",
    );
    const { data } = await supabase.rpc("finalize_session_grading", { p_session_id: sessionId });
    setFinalizing(false);
    const result = data as { still_pending?: boolean } | null;
    if (result?.still_pending) {
      hideOverlay();
      toast.info("Some answers are still pending grading.");
    } else {
      advanceOverlay(1);
      advanceOverlay(2);
      finishOverlay();
      toast.success("Session finalized — moved to quiz history!");
      setTimeout(() => {
        hideOverlay();
        void navigate({ to: "/quiz-history" });
      }, 500);
    }
  }, [sessionId, navigate]);

  // Per-answer AI grading (called from AnswerRow)
  const handleRunAi = useCallback(async (answer: GradeAnswer, criteriaNote: string): Promise<AiResult> => {
    if (!user) throw new Error("Not authenticated");
    const cost = answer.question_type === "long_answer" ? creditCostLong : creditCostShort;
    const { data: ok, error: deductErr } = await supabase.rpc("deduct_credits", {
      p_user_id: user.id, p_amount: cost, p_type: "ai_grading",
      p_description: `AI graded ${answer.question_type} answer`,
    });
    if (deductErr || !ok) throw new Error("Insufficient credits or deduction failed");
    reload();

    const result = await gradeAnswerWithAi({
      data: {
        questionText: sanitizeForAi(answer.question_text, 500),
        questionType: answer.question_type,
        modelAnswer: answer.model_answer ? sanitizeForAi(answer.model_answer, 500) : "",
        rubric: sanitizeForAi(
          answer.rubric ? `${answer.rubric}\n\nEvaluate on: ${criteriaNote}` : `Evaluate on: ${criteriaNote}`,
          600,
        ),
        studentAnswer: sanitizeForAi(answer.answer_text ?? "", 2000),
        maxPoints: answer.max_points,
      },
    });
    return result;
  }, [user, creditCostShort, creditCostLong, reload]);

  // Group answers by question for manual mode
  const questionGroups: QuestionGroup[] = [];
  for (const a of answers) {
    let g = questionGroups.find((g) => g.question_id === a.question_id);
    if (!g) {
      g = { question_id: a.question_id, question_text: a.question_text, question_type: a.question_type, max_points: a.max_points, model_answer: a.model_answer, rubric: a.rubric, answers: [] };
      questionGroups.push(g);
    }
    g.answers.push(a);
  }

  const pending = answers.filter((a) => a.graded_at === null);
  const graded = answers.filter((a) => a.graded_at !== null);
  const totalCost = pending.reduce((s, a) => s + (a.question_type === "long_answer" ? creditCostLong : creditCostShort), 0);

  // ── AI bulk grade (batch — single AI call for all pending answers) ──
  const runAiGrade = async () => {
    if (!user) return;
    setMode("ai-running");
    setAiRunning(true);
    setAiProgress(0);
    const aiPending = pending;
    const criteriaNote = buildCriteriaNote(criteria);

    showOverlay(
      "AI is grading your answers",
      [
        { label: "Deducting credits",         detail: `${totalCost} credits for ${aiPending.length} answer${aiPending.length === 1 ? "" : "s"}` },
        { label: "Sending answers to Claude", detail: "Sanitising input and bundling questions, model answers, rubrics…" },
        { label: "Receiving AI evaluations",  detail: "Each answer is scored against your criteria — this is the longest step." },
        { label: "Preparing review",          detail: "Building the review screen so you can adjust marks before saving…" },
      ],
      `${aiPending.length} answer${aiPending.length === 1 ? "" : "s"} · ~${Math.max(5, aiPending.length * 2)}s`,
    );

    try {
      // Step 1: deduct credits
      const { data: ok, error: deductErr } = await supabase.rpc("deduct_credits", {
        p_user_id: user.id, p_amount: totalCost, p_type: "ai_grading",
        p_description: `Batch AI grading: ${aiPending.length} answers`,
      });
      if (deductErr || !ok) {
        console.error("Credit deduction failed:", deductErr);
        toast.error(`Credit deduction failed${deductErr ? `: ${deductErr.message}` : ""}`);
        setAiRunning(false);
        setMode("ai-setup");
        hideOverlay();
        return;
      }

      setAiProgress(20);
      advanceOverlay(1);
      // Step 2 visual: AI call in flight
      advanceOverlay(2);

      // Single AI call for all answers (inputs sanitized)
      const { results } = await gradeAllAnswersWithAi({
        data: {
          questions: aiPending.map((a) => ({
            id: a.id,
            questionText: sanitizeForAi(a.question_text, 500),
            questionType: a.question_type,
            studentAnswer: sanitizeForAi(a.answer_text ?? "", 2000),
            maxPoints: a.max_points,
            modelAnswer: a.model_answer ? sanitizeForAi(a.model_answer, 500) : undefined,
            rubric: sanitizeForAi(
              a.rubric ? `${a.rubric}\n\nEvaluate on: ${criteriaNote}` : `Evaluate on: ${criteriaNote}`,
              600,
            ),
          })),
        },
      });

      setAiProgress(90);
      advanceOverlay(3);

      // Build review items — DO NOT save yet, let host review first
      const items: AiReviewItem[] = results.map((r) => {
        const answer = aiPending.find((a) => a.id === r.id)!;
        return { answer, result: r, adjustedPoints: r.points };
      });

      setAiReviewItems(items);
      setAiProgress(100);
      finishOverlay();
      setAiRunning(false);
      setMode("ai-review");
      setTimeout(hideOverlay, 400);
    } catch (err: any) {
      console.error("Batch AI grading failed:", err);
      toast.error(`AI grading failed: ${err?.message ?? "unknown error"}`);
      setAiRunning(false);
      setMode("select");
      hideOverlay();
    }
  };

  // Confirm reviewed AI marks → save to DB
  const confirmAiReview = async () => {
    setSavingReview(true);
    showOverlay(
      "Saving reviewed marks",
      [
        { label: "Writing graded answers",     detail: `Saving ${aiReviewItems.length} answer${aiReviewItems.length === 1 ? "" : "s"} with the marks you confirmed…` },
        { label: "Recomputing attempt scores", detail: "Updating each participant's total score…" },
      ],
      `${aiReviewItems.length} reviewed answer${aiReviewItems.length === 1 ? "" : "s"}`,
    );
    try {
      const affectedAttempts = new Set<string>();
      for (const item of aiReviewItems) {
        const { error: upErr } = await supabase.from("quiz_answers").update({
          points_awarded: item.adjustedPoints,
          grader_comment: item.result.comment || null,
          graded_at: new Date().toISOString(),
          graded_by_ai: true,
        } as any).eq("id", item.answer.id);
        if (upErr) { console.error("Update failed for", item.answer.id, upErr); continue; }
        affectedAttempts.add(item.answer.attempt_id);
        await handleGraded(item.answer.id, item.adjustedPoints, item.result.comment);
      }
      advanceOverlay(1);
      for (const attemptId of affectedAttempts) {
        const { data: pts } = await supabase.from("quiz_answers").select("points_awarded").eq("attempt_id", attemptId);
        const newScore = (pts ?? []).reduce((s, r) => s + (((r as any).points_awarded as number) ?? 0), 0);
        await supabase.from("quiz_attempts").update({ score: newScore }).eq("id", attemptId);
      }
      finishOverlay();
      reload();
      toast.success(`${aiReviewItems.length} answers saved!`);
      setAiReviewItems([]);
      setMode("select");
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message ?? "unknown error"}`);
    } finally {
      setSavingReview(false);
      setTimeout(hideOverlay, 400);
    }
  };

  const currentGroup = questionGroups[questionIndex];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/sessions/$sessionId" params={{ sessionId }}>
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-bold truncate">Grading</h1>
            <p className="text-sm text-muted-foreground truncate">{sessionTitle}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            <Users className="h-4 w-4" />
            <span>{graded.length}/{answers.length} graded</span>
          </div>
        </div>

        {/* Progress bar */}
        {answers.length > 0 && (
          <div className="rounded-xl border border-border bg-card/40 px-5 py-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>{graded.length} graded</span>
              <span>{pending.length} pending</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              {/* eslint-disable-next-line react/forbid-dom-props */}
              <div className="h-full rounded-full bg-gradient-primary transition-all"
                style={{ width: `${answers.length ? (graded.length / answers.length) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        {answers.length === 0 && (
          <div className="rounded-2xl border border-border bg-card/40 p-10 text-center">
            <p className="text-muted-foreground">No typed answers to grade.</p>
          </div>
        )}

        {/* ── MODE SELECT — all graded ── */}
        {answers.length > 0 && mode === "select" && pending.length === 0 && sessionStatus === "grading" && (
          <div className="rounded-2xl border border-success/30 bg-success/5 p-5 text-center space-y-4 mb-4">
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <div>
              <p className="font-semibold">All answers graded!</p>
              <p className="text-xs text-muted-foreground mt-1">Review your marks before closing, or finalize the session now.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="outline" onClick={() => { setMode("manual"); setQuestionIndex(0); }}
                className="gap-2">
                <PenLine className="h-4 w-4" />
                Review marks
              </Button>
              <Button onClick={() => void handleFinalize()} disabled={finalizing}
                className="gap-2 bg-gradient-primary text-primary-foreground">
                {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Finalize &amp; Close Session
              </Button>
            </div>
          </div>
        )}

        {answers.length > 0 && mode === "select" && pending.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">How do you want to grade the answers?</p>
            <div className="grid grid-cols-2 gap-4">
              <button type="button" onClick={() => { setMode("manual"); setQuestionIndex(0); }}
                className="rounded-2xl border-2 border-border bg-card/60 hover:border-primary/60 hover:bg-primary/5 p-6 text-left space-y-2 transition-all group">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <PenLine className="h-6 w-6 text-primary" />
                </div>
                <div className="font-semibold">Grade Manually</div>
                <p className="text-xs text-muted-foreground">Review each answer yourself. Use AI on individual answers anytime.</p>
              </button>
              <button type="button" onClick={() => setMode("ai-setup")}
                className="rounded-2xl border-2 border-border bg-card/60 hover:border-primary/60 hover:bg-primary/5 p-6 text-left space-y-2 transition-all group">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="font-semibold">Grade All with AI</div>
                <p className="text-xs text-muted-foreground">Set criteria once, AI grades all {pending.length} answers. ({totalCost} credits)</p>
              </button>
            </div>
          </div>
        )}

        {/* ── MANUAL MODE ── */}
        {mode === "manual" && currentGroup && (
          <div className="space-y-5">
            {/* Question nav */}
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setMode("select")} className="gap-1 text-muted-foreground">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <span className="text-sm font-semibold text-muted-foreground">
                Question {questionIndex + 1} of {questionGroups.length}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={questionIndex === 0}
                  onClick={() => setQuestionIndex((i) => i - 1)} className="gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" disabled={questionIndex === questionGroups.length - 1}
                  onClick={() => setQuestionIndex((i) => i + 1)} className="gap-1">
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Question card */}
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary/15 text-primary border-0 text-xs uppercase tracking-wider">
                  {currentGroup.question_type === "long_answer" ? "Long Answer" : "Short Answer"}
                </Badge>
                <span className="text-xs text-muted-foreground">{currentGroup.max_points} pts max</span>
              </div>
              <p className="font-semibold text-foreground leading-relaxed">{currentGroup.question_text}</p>
              {currentGroup.model_answer && (
                <details className="group">
                  <summary className="cursor-pointer list-none flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground select-none">
                    <ChevronDown className="h-3.5 w-3.5 group-open:hidden" />
                    <ChevronUp className="h-3.5 w-3.5 hidden group-open:block" />
                    Show model answer
                  </summary>
                  <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary/90 whitespace-pre-wrap leading-relaxed">
                    {currentGroup.model_answer}
                  </div>
                </details>
              )}
              {currentGroup.rubric && (
                <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Rubric</div>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{currentGroup.rubric}</p>
                </div>
              )}
            </div>

            {/* Answers */}
            <p className="text-xs text-muted-foreground text-center">
              Student names are hidden for fair grading · {currentGroup.answers.filter((a) => a.graded_at !== null && !unlockedIds.has(a.id)).length}/{currentGroup.answers.length} graded
            </p>
            <div className="space-y-4">
              {currentGroup.answers.map((a, i) => (
                <AnswerRow
                  key={a.id}
                  answer={a}
                  index={i}
                  grade={getRowGrade(a)}
                  onGradeChange={(g) => setRowGrades((prev) => ({ ...prev, [a.id]: g }))}
                  saving={savingAll}
                  onGraded={handleGraded}
                  onRunAi={handleRunAi}
                  creditCost={a.question_type === "long_answer" ? creditCostLong : creditCostShort}
                  canAffordAi={credits.balance >= (a.question_type === "long_answer" ? creditCostLong : creditCostShort)}
                  isUnlocked={unlockedIds.has(a.id)}
                  onEditGrade={() => handleEditGrade(a)}
                />
              ))}
            </div>

            {/* Single Save All Grades button for unsaved (or reopened) answers in this question */}
            {currentGroup.answers.some(isUnsavedForUI) && (
              <Button
                onClick={() => void handleSaveAllGrades(currentGroup.answers)}
                disabled={savingAll}
                className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
              >
                {savingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {savingAll ? "Saving…" : `Save Grades (${currentGroup.answers.filter(isUnsavedForUI).length} answers)`}
              </Button>
            )}

            {questionIndex < questionGroups.length - 1 && (
              <Button onClick={() => setQuestionIndex((i) => i + 1)}
                className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
                Next Question <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {questionIndex === questionGroups.length - 1 && pending.length === 0 && (
              <div className="rounded-2xl border border-success/30 bg-success/5 p-5 text-center space-y-4">
                <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
                <div>
                  <p className="font-semibold">All answers graded!</p>
                  <p className="text-xs text-muted-foreground mt-1">Review the marks once more or finalize the session.</p>
                </div>
                <div className="flex flex-col gap-2">
                  {sessionStatus === "grading" && (
                    <Button onClick={() => void handleFinalize()} disabled={finalizing}
                      className="gap-2 bg-gradient-primary text-primary-foreground">
                      {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Finalize &amp; Close Session
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setQuestionIndex(0)}
                    className="gap-2">
                    <PenLine className="h-4 w-4" />
                    Review marks from the start
                  </Button>
                  <Button variant="ghost" onClick={() => void navigate({ to: "/sessions/$sessionId", params: { sessionId } })}
                    className="gap-2">
                    Back to Session
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AI BULK SETUP ── */}
        {mode === "ai-setup" && (
          <div className="space-y-5">
            <Button variant="ghost" size="sm" onClick={() => setMode("select")} className="gap-1 text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>

            <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-5">
              <div>
                <h2 className="font-semibold text-lg">AI Grading Setup</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Set your marking criteria. AI will grade all {pending.length} answers using these rules.
                </p>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Marking Criteria</div>
                {([
                  { key: "concepts", label: "Concepts & Key Ideas", desc: "Does the answer cover the main concepts?" },
                  { key: "relevance", label: "Relevance", desc: "Is the answer relevant to the question?" },
                  { key: "grammar", label: "Grammar", desc: "Is the answer grammatically correct?" },
                  { key: "spelling", label: "Spelling", desc: "Are words spelled correctly?" },
                ] as { key: keyof AiCriteria; label: string; desc: string }[]).map(({ key, label, desc }) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer group">
                    <Checkbox
                      checked={criteria[key] as boolean}
                      onCheckedChange={(v) => setCriteria((c) => ({ ...c, [key]: !!v }))}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-sm font-medium group-hover:text-primary transition-colors">{label}</div>
                      <div className="text-xs text-muted-foreground">{desc}</div>
                    </div>
                  </label>
                ))}

                <div className="pt-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                    Additional Instructions (optional)
                  </label>
                  <Textarea
                    placeholder="e.g. Focus on technical accuracy, check for use of proper terminology…"
                    value={criteria.custom}
                    onChange={(e) => setCriteria((c) => ({ ...c, custom: e.target.value }))}
                    rows={3}
                    className="resize-none text-sm"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card/50 divide-y divide-border text-sm">
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Answers to grade</span>
                  <span className="font-semibold">{pending.length}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Total cost</span>
                  <span className="font-semibold text-primary">{totalCost} credits</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Your balance</span>
                  <span className={credits.balance >= totalCost ? "font-semibold text-success" : "font-semibold text-destructive"}>
                    {credits.balance} credits
                  </span>
                </div>
              </div>

              <Button
                onClick={() => void runAiGrade()}
                disabled={credits.balance < totalCost || pending.length === 0 || !Object.values(criteria).some(Boolean)}
                className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
              >
                <Sparkles className="h-4 w-4" />
                Start AI Grading ({totalCost} credits)
              </Button>
            </div>
          </div>
        )}

        {/* ── AI REVIEW ── */}
        {mode === "ai-review" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" /> Review AI Marks
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  AI suggested these marks. Adjust any before saving.
                </p>
              </div>
              <Button
                onClick={() => void confirmAiReview()}
                disabled={savingReview}
                className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
              >
                {savingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirm & Save All
              </Button>
            </div>

            <div className="space-y-3">
              {aiReviewItems.map((item, idx) => (
                <div key={item.answer.id} className="rounded-2xl border border-primary/20 bg-card/60 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase rounded bg-muted/60 px-1.5 py-0.5 text-muted-foreground">
                          {item.answer.question_type === "long_answer" ? "Long" : "Short"}
                        </span>
                        <span className="text-xs text-muted-foreground">Q{idx + 1}</span>
                      </div>
                      <p className="text-sm font-medium leading-snug">{item.answer.question_text}</p>
                    </div>
                    {/* Points adjuster */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setAiReviewItems((prev) => prev.map((x, i) => i === idx ? { ...x, adjustedPoints: Math.max(0, x.adjustedPoints - 1) } : x))}
                        className="w-7 h-7 rounded-lg border border-border hover:bg-muted/40 flex items-center justify-center text-sm font-bold transition-colors"
                      >−</button>
                      <span className="text-sm font-bold w-8 text-center">
                        {item.adjustedPoints}
                        <span className="text-xs text-muted-foreground font-normal">/{item.answer.max_points}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setAiReviewItems((prev) => prev.map((x, i) => i === idx ? { ...x, adjustedPoints: Math.min(x.answer.max_points, x.adjustedPoints + 1) } : x))}
                        className="w-7 h-7 rounded-lg border border-border hover:bg-muted/40 flex items-center justify-center text-sm font-bold transition-colors"
                      >+</button>
                    </div>
                  </div>
                  {/* Student answer */}
                  <div className="rounded-lg bg-muted/20 border border-border px-3 py-2 text-xs text-foreground">
                    {item.answer.answer_text || <span className="italic text-muted-foreground">No answer submitted</span>}
                  </div>
                  {/* AI reasoning */}
                  <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                    <Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-primary/60" />
                    <span>{item.result.reasoning}</span>
                  </div>
                  {item.adjustedPoints !== item.result.points && (
                    <div className="text-[11px] text-warning">
                      AI suggested {item.result.points}/{item.answer.max_points} · you changed to {item.adjustedPoints}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button
              onClick={() => void confirmAiReview()}
              disabled={savingReview}
              className="w-full gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
            >
              {savingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirm & Save All {aiReviewItems.length} Marks
            </Button>
          </div>
        )}

        {/* ── AI BULK RUNNING ── */}
        {mode === "ai-running" && (
          <div className="rounded-2xl border border-border bg-card/60 p-10 text-center space-y-5">
            <div className="h-16 w-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto shadow-glow">
              <Sparkles className="h-8 w-8 text-primary-foreground animate-pulse" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">AI Grading in Progress</h2>
              <p className="text-sm text-muted-foreground mt-1">Please wait while AI reviews all answers…</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{aiProgress}%</span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden">
                {/* eslint-disable-next-line react/forbid-dom-props */}
                <div className="h-full rounded-full bg-gradient-primary transition-all duration-300"
                  style={{ width: `${aiProgress}%` }} />
              </div>
            </div>
            {!aiRunning && (
              <Button onClick={() => void navigate({ to: "/sessions/$sessionId", params: { sessionId } })}
                className="gap-2 bg-gradient-primary text-primary-foreground">
                Back to Session
              </Button>
            )}
          </div>
        )}

      </div>

      <LoadingOverlay
        visible={overlay.visible}
        variant="driven"
        title={overlay.title}
        steps={overlay.steps}
        currentStep={overlay.step}
        hint={overlay.hint}
      />
    </div>
  );
}
