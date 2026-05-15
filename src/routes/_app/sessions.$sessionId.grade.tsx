import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  CircleSlash,
  Coins,
  Loader2,
  MessageSquare,
  Minus,
  PenLine,
  FileText,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { usePlan } from "@/contexts/PlanContext";
import { gradeAnswerWithAi } from "@/components/grading/gradeAnswer.server";

export const Route = createFileRoute("/_app/sessions/$sessionId/grade")({
  component: GradePage,
});

// ─── Types ──────────────────────────────────────────────────────

type QuestionType = "short_answer" | "long_answer";

type GradeAnswer = {
  id: string;
  answer_text: string | null;
  points_awarded: number | null;
  graded_at: string | null;
  grader_comment: string | null;
  question_id: string;
  question_text: string;
  question_type: QuestionType;
  max_points: number;
  model_answer: string | null;
  rubric: string | null;
  participant_name: string | null;
  attempt_id: string;
};

type GradeVerdict = "correct" | "partial" | "wrong";

// ─── Helpers ─────────────────────────────────────────────────────

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

// ─── Answer card ─────────────────────────────────────────────────

type CardProps = {
  answer: GradeAnswer;
  creditCostPerAnswer: number;
  onGraded: (answerId: string, points: number, comment: string) => void;
};

function AnswerCard({ answer, creditCostPerAnswer, onGraded }: CardProps) {
  const { credits, reload } = usePlan();
  const { user } = useAuth();
  const [verdict, setVerdict] = useState<GradeVerdict | null>(null);
  const [comment, setComment] = useState(answer.grader_comment ?? "");
  const [showComment, setShowComment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(answer.graded_at !== null);
  const [customPoints, setCustomPoints] = useState<number | null>(null);
  const [aiGrading, setAiGrading] = useState(false);

  const alreadyGraded = answer.graded_at !== null;
  const effectivePoints =
    verdict !== null
      ? (customPoints ?? verdictPoints(verdict, answer.max_points))
      : answer.points_awarded;

  const save = async () => {
    if (!verdict) return;
    const points = customPoints ?? verdictPoints(verdict, answer.max_points);
    setSaving(true);
    try {
      const { error } = await supabase
        .from("quiz_answers")
        .update({
          points_awarded: points,
          grader_comment: comment.trim() || null,
          graded_at: new Date().toISOString(),
          // graded_by populated server-side via auth.uid() ideally, but client sets it here
        } as any)
        .eq("id", answer.id);

      if (error) throw error;
      setSaved(true);
      onGraded(answer.id, points, comment.trim());
      toast.success("Graded ✓");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const aiGrade = async () => {
    if (!user) return;
    if (credits.balance < creditCostPerAnswer) {
      toast.error(`Not enough credits. Need ${creditCostPerAnswer}, have ${credits.balance}.`);
      return;
    }
    setAiGrading(true);
    try {
      // Deduct credits first
      const { data: ok, error: deductErr } = await supabase.rpc("deduct_credits", {
        p_user_id: user.id,
        p_amount: creditCostPerAnswer,
        p_type: "ai_grading",
        p_description: `AI graded ${answer.question_type} answer`,
      });
      if (deductErr || !ok) {
        toast.error("Credit deduction failed. " + (deductErr?.message ?? "Insufficient credits."));
        return;
      }
      reload();

      const result = await gradeAnswerWithAi({
        data: {
          questionText: answer.question_text,
          questionType: answer.question_type,
          modelAnswer: answer.model_answer ?? "",
          rubric: answer.rubric ?? "",
          studentAnswer: answer.answer_text ?? "",
          maxPoints: answer.max_points,
        },
      });

      // Persist directly
      const { error } = await supabase
        .from("quiz_answers")
        .update({
          points_awarded: result.points,
          grader_comment: result.comment || null,
          graded_at: new Date().toISOString(),
          graded_by_ai: true,
        } as any)
        .eq("id", answer.id);
      if (error) throw error;

      setComment(result.comment);
      setCustomPoints(result.points);
      setSaved(true);
      onGraded(answer.id, result.points, result.comment);
      toast.success(`AI graded: ${result.points}/${answer.max_points} pts · ${creditCostPerAnswer} credits used`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAiGrading(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border bg-card/60 p-5 space-y-4 transition-all ${
        saved ? "border-success/30 bg-success/5" : "border-border"
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {answer.question_type === "long_answer" ? (
            <FileText className="h-4 w-4 text-primary" />
          ) : (
            <PenLine className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              {answer.question_type === "long_answer" ? "Long Answer" : "Short Answer"}
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{answer.participant_name ?? "Anonymous"}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{answer.max_points} pts max</span>
            {saved && (
              <Badge variant="outline" className="border-success/50 text-success text-[10px] py-0">
                Graded · {effectivePoints}/{answer.max_points}
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-sm font-semibold leading-snug">{answer.question_text}</p>
        </div>
      </div>

      {/* Student answer */}
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          Student's Answer
        </div>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {answer.answer_text?.trim() || <span className="italic text-muted-foreground">No answer submitted</span>}
        </p>
      </div>

      {/* Model answer (collapsible) */}
      {answer.model_answer && (
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground select-none">
            <ChevronDown className="h-3.5 w-3.5 group-open:hidden" />
            <ChevronUp className="h-3.5 w-3.5 hidden group-open:block" />
            Show model answer
          </summary>
          <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary/90 whitespace-pre-wrap leading-relaxed">
            {answer.model_answer}
          </div>
        </details>
      )}

      {/* Rubric */}
      {answer.rubric && (
        <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Rubric</div>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{answer.rubric}</p>
        </div>
      )}

      {/* Verdict buttons */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {(["correct", "partial", "wrong"] as GradeVerdict[]).map((v) => {
            const active = verdict === v;
            const icons = {
              correct: <Check className="h-4 w-4" />,
              partial: <Minus className="h-4 w-4" />,
              wrong: <CircleSlash className="h-4 w-4" />,
            };
            const labels = { correct: `Correct (${answer.max_points}pts)`, partial: `Partial (${verdictPoints("partial", answer.max_points)}pts)`, wrong: "Wrong (0pts)" };
            return (
              <button
                key={v}
                type="button"
                disabled={saving || saved}
                onClick={() => {
                  setVerdict(v);
                  setCustomPoints(null);
                }}
                className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all ${
                  active ? verdictColor(v) : "border-border bg-card/40 text-muted-foreground hover:border-primary/40"
                } ${saving || saved ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
              >
                {icons[v]}
                <span className="hidden sm:inline">{labels[v]}</span>
                <span className="sm:hidden capitalize">{v}</span>
              </button>
            );
          })}
        </div>

        {/* Custom points (only when verdict selected + max_points > 2) */}
        {verdict && answer.max_points > 2 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground shrink-0">Custom points:</span>
            <input
              type="number"
              aria-label="Custom points"
              title="Custom points"
              min={0}
              max={answer.max_points}
              value={customPoints ?? verdictPoints(verdict, answer.max_points)}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 0 && n <= answer.max_points) setCustomPoints(n);
              }}
              disabled={saving || saved}
              className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            />
            <span className="text-xs text-muted-foreground">/ {answer.max_points}</span>
          </div>
        )}

        {/* Comment toggle */}
        <button
          type="button"
          onClick={() => setShowComment((p) => !p)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          disabled={saving || saved}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {showComment ? "Hide comment" : "Add comment (optional)"}
        </button>

        {showComment && (
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Feedback for the student…"
            rows={2}
            disabled={saving || saved}
            className="resize-none text-sm"
          />
        )}

        {!saved && (
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={save}
              disabled={!verdict || saving || aiGrading}
              className="flex-1 bg-gradient-primary text-primary-foreground shadow-glow"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {saving ? "Saving…" : "Save Grade"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={aiGrade}
              disabled={saving || aiGrading || credits.balance < creditCostPerAnswer}
              title={`AI grade this answer (${creditCostPerAnswer} credits)`}
              className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
            >
              {aiGrading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {aiGrading ? "Grading…" : `AI Grade (${creditCostPerAnswer} cr)`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────

function GradePage() {
  const { sessionId } = Route.useParams();
  const { user } = useAuth();
  const { plan, credits, reload } = usePlan();
  const [answers, setAnswers] = useState<GradeAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionTitle, setSessionTitle] = useState("");
  const [filter, setFilter] = useState<"pending" | "graded" | "all">("pending");
  const [bulkAiRunning, setBulkAiRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load session title
      const { data: sess } = await supabase
        .from("quiz_sessions")
        .select("title")
        .eq("id", sessionId)
        .single();
      if (sess) setSessionTitle(sess.title ?? "Session");

      // Load quiz_answers joined with questions and attempts
      const { data, error } = await supabase
        .from("quiz_answers")
        .select(`
          id,
          answer_text,
          points_awarded,
          graded_at,
          grader_comment,
          question_id,
          attempt_id,
          quiz_attempts!inner(
            session_id,
            participant_name
          ),
          questions!inner(
            text,
            type,
            max_points,
            model_answer,
            rubric
          )
        `)
        .eq("quiz_attempts.session_id", sessionId)
        .in("questions.type", ["short_answer", "long_answer"] as any)
        .order("graded_at", { ascending: true, nullsFirst: true });

      if (error) throw error;

      const rows: GradeAnswer[] = (data ?? []).map((row: any) => ({
        id: row.id,
        answer_text: row.answer_text,
        points_awarded: row.points_awarded,
        graded_at: row.graded_at,
        grader_comment: row.grader_comment,
        question_id: row.question_id,
        question_text: row.questions?.text ?? "",
        question_type: (row.questions?.type ?? "short_answer") as QuestionType,
        max_points: row.questions?.max_points ?? 1,
        model_answer: row.questions?.model_answer ?? null,
        rubric: row.questions?.rubric ?? null,
        participant_name: row.quiz_attempts?.participant_name ?? null,
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

  const handleGraded = useCallback((answerId: string, points: number, comment: string) => {
    setAnswers((prev) =>
      prev.map((a) =>
        a.id === answerId
          ? { ...a, points_awarded: points, graded_at: new Date().toISOString(), grader_comment: comment || null }
          : a,
      ),
    );
  }, []);

  const pending = answers.filter((a) => a.graded_at === null);
  const graded = answers.filter((a) => a.graded_at !== null);
  const displayed = filter === "pending" ? pending : filter === "graded" ? graded : answers;

  // Credit cost per answer based on type
  const creditCostFor = (type: QuestionType) =>
    type === "long_answer"
      ? (plan?.credit_cost_ai_grade_long ?? 3)
      : (plan?.credit_cost_ai_grade_short ?? 1);

  const bulkPendingCost = pending.reduce((sum, a) => sum + creditCostFor(a.question_type), 0);

  const runBulkAiGrade = async () => {
    if (!user) return;
    if (credits.balance < bulkPendingCost) {
      toast.error(`Need ${bulkPendingCost} credits for ${pending.length} answers, you have ${credits.balance}.`);
      return;
    }
    setBulkAiRunning(true);
    let done = 0;
    let failed = 0;
    for (const answer of pending) {
      const cost = creditCostFor(answer.question_type);
      try {
        const { data: ok, error: deductErr } = await supabase.rpc("deduct_credits", {
          p_user_id: user.id,
          p_amount: cost,
          p_type: "ai_grading",
          p_description: `AI graded ${answer.question_type} answer (bulk)`,
        });
        if (deductErr || !ok) { failed++; continue; }

        const result = await gradeAnswerWithAi({
          data: {
            questionText: answer.question_text,
            questionType: answer.question_type,
            modelAnswer: answer.model_answer ?? "",
            rubric: answer.rubric ?? "",
            studentAnswer: answer.answer_text ?? "",
            maxPoints: answer.max_points,
          },
        });

        await supabase.from("quiz_answers").update({
          points_awarded: result.points,
          grader_comment: result.comment || null,
          graded_at: new Date().toISOString(),
          graded_by_ai: true,
        } as any).eq("id", answer.id);

        handleGraded(answer.id, result.points, result.comment);
        done++;
      } catch {
        failed++;
      }
    }
    reload();
    setBulkAiRunning(false);
    if (failed === 0) {
      toast.success(`AI graded ${done} answers · ${bulkPendingCost} credits used`);
    } else {
      toast.warning(`Graded ${done}, failed ${failed}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/sessions/$sessionId" params={{ sessionId }}>
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-bold truncate">Manual Grading</h1>
            <p className="text-sm text-muted-foreground truncate">{sessionTitle}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
            <Users className="h-4 w-4" />
            <span>
              {graded.length}/{answers.length} graded
            </span>
          </div>
        </div>

        {/* Progress bar + bulk AI grade */}
        {answers.length > 0 && (
          <div className="rounded-xl border border-border bg-card/40 px-5 py-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Coins className="h-3.5 w-3.5 text-warning" />
                <span className="text-warning font-semibold">{credits.balance}</span>
                <span>credits</span>
              </div>
              {pending.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={runBulkAiGrade}
                  disabled={bulkAiRunning || credits.balance < bulkPendingCost}
                  className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10 text-xs"
                >
                  {bulkAiRunning
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Sparkles className="h-3.5 w-3.5" />}
                  {bulkAiRunning
                    ? "Grading all…"
                    : `AI Grade All Pending (${bulkPendingCost} cr)`}
                </Button>
              )}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{pending.length} pending</span>
              <span>{graded.length} graded</span>
            </div>
            <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full bg-gradient-primary rounded-full transition-all duration-500"
                // eslint-disable-next-line react/forbid-dom-props
                style={{ width: `${answers.length > 0 ? (graded.length / answers.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(["pending", "graded", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-xl border px-4 py-1.5 text-sm font-medium transition-all capitalize ${
                filter === f
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {f}{" "}
              <span className="text-xs opacity-70">
                ({f === "pending" ? pending.length : f === "graded" ? graded.length : answers.length})
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground space-y-2">
            {filter === "pending" ? (
              <>
                <Check className="h-10 w-10 mx-auto text-success opacity-60" />
                <p className="font-semibold">All caught up!</p>
                <p className="text-sm">No pending answers to grade.</p>
              </>
            ) : (
              <>
                <PenLine className="h-10 w-10 mx-auto opacity-40" />
                <p className="text-sm">No answers here.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {displayed.map((answer) => (
              <AnswerCard
                key={answer.id}
                answer={answer}
                creditCostPerAnswer={creditCostFor(answer.question_type)}
                onGraded={handleGraded}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
