import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePlan } from "@/contexts/PlanContext";
import { gradeAnswerWithAi, gradeAllAnswersWithAi } from "@/components/grading/gradeAnswer.server";
import type { Step } from "@/components/ui/LoadingOverlay";
import { buildCriteriaNote, sanitizeForAi, verdictPoints } from "./types";
import type {
  AiCriteria,
  AiResult,
  AiReviewItem,
  GradeAnswer,
  GradeVerdict,
  PageMode,
  QuestionGroup,
  RowGrade,
} from "./types";

export function useGradePage(sessionId: string) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plan, credits, reload } = usePlan();

  const [answers, setAnswers] = useState<GradeAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionStatus, setSessionStatus] = useState("");
  const [mode, setMode] = useState<PageMode>("select");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [rowGrades, setRowGrades] = useState<Record<string, RowGrade>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(new Set());

  const [overlay, setOverlay] = useState<{
    visible: boolean;
    title: string;
    steps: Step[];
    step: number;
    hint?: string;
  }>({
    visible: false,
    title: "",
    steps: [],
    step: 0,
  });
  const showOverlay = (title: string, steps: Step[], hint?: string) =>
    setOverlay({ visible: true, title, steps, step: 0, hint });
  const advanceOverlay = (step: number) => setOverlay((prev) => ({ ...prev, step }));
  const finishOverlay = () => setOverlay((prev) => ({ ...prev, step: prev.steps.length }));
  const hideOverlay = () => setOverlay((prev) => ({ ...prev, visible: false }));

  const [criteria, setCriteria] = useState<AiCriteria>({
    concepts: true,
    grammar: false,
    spelling: false,
    relevance: true,
    custom: "",
  });
  const [aiRunning, setAiRunning] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiReviewItems, setAiReviewItems] = useState<AiReviewItem[]>([]);
  const [savingReview, setSavingReview] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const creditCostShort = plan?.credit_cost_ai_grade_short ?? 1;
  const creditCostLong = plan?.credit_cost_ai_grade_long ?? 3;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: sess } = await supabase
        .from("quiz_sessions")
        .select("title, status")
        .eq("id", sessionId)
        .single();
      if (sess) {
        setSessionTitle(sess.title ?? "Session");
        setSessionStatus(sess.status ?? "");
      }

      const { data: attemptRows } = await supabase
        .from("quiz_attempts")
        .select("id, participant_name")
        .eq("session_id", sessionId);
      const attemptIds = (attemptRows ?? []).map((a) => a.id);
      const participantMap = Object.fromEntries(
        (attemptRows ?? []).map((a) => [a.id, a.participant_name]),
      );
      if (attemptIds.length === 0) {
        setAnswers([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("quiz_answers")
        .select(
          `
        id, answer, points_awarded, graded_at, grader_comment, question_id, attempt_id,
        questions!inner(text, type, max_points, grading_mode, model_answer, rubric)
      `,
        )
        .in("attempt_id", attemptIds)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .in("questions.type", ["short_answer", "long_answer"] as any)
        .order("graded_at", { ascending: true, nullsFirst: true });

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: GradeAnswer[] = (data ?? []).map((row: any) => ({
        id: row.id,
        answer_text: row.answer,
        points_awarded: row.points_awarded,
        graded_at: row.graded_at,
        grader_comment: row.grader_comment,
        question_id: row.question_id,
        question_text: row.questions?.text ?? "",
        question_type: (row.questions?.type ?? "short_answer") as GradeAnswer["question_type"],
        grading_mode: (row.questions?.grading_mode ?? "manual") as GradeAnswer["grading_mode"],
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

  useEffect(() => {
    void load();
  }, [load]);

  const handleGraded = useCallback(async (answerId: string, points: number, comment: string) => {
    setAnswers((prev) =>
      prev.map((a) =>
        a.id === answerId
          ? {
              ...a,
              points_awarded: points,
              graded_at: new Date().toISOString(),
              grader_comment: comment || null,
            }
          : a,
      ),
    );
    setUnlockedIds((prev) => {
      if (!prev.has(answerId)) return prev;
      const next = new Set(prev);
      next.delete(answerId);
      return next;
    });
  }, []);

  const handleEditGrade = useCallback((answer: GradeAnswer) => {
    const verdict: GradeVerdict | null =
      answer.points_awarded == null
        ? null
        : answer.points_awarded === answer.max_points
          ? "correct"
          : answer.points_awarded === 0
            ? "wrong"
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
        ? answer.points_awarded === answer.max_points
          ? "correct"
          : answer.points_awarded === 0
            ? "wrong"
            : "partial"
        : null,
      customPoints: null,
      comment: answer.grader_comment ?? "",
      showComment: false,
    };

  const isUnsavedForUI = (a: GradeAnswer) => a.graded_at === null || unlockedIds.has(a.id);

  const handleSaveAllGrades = useCallback(
    async (groupAnswers: GradeAnswer[]) => {
      const unsaved = groupAnswers.filter((a) => a.graded_at === null || unlockedIds.has(a.id));
      const missing = unsaved.filter((a) => !rowGrades[a.id]?.verdict);
      if (missing.length > 0) {
        toast.error(
          `Please select a verdict for all ${missing.length} remaining answer(s) before saving.`,
        );
        return;
      }
      setSavingAll(true);
      showOverlay(
        "Saving grades",
        [
          {
            label: "Validating verdicts",
            detail: `${unsaved.length} answer${unsaved.length === 1 ? "" : "s"} ready to save`,
          },
          {
            label: "Writing grades to database",
            detail: "Recording points and comments for each answer…",
          },
          {
            label: "Updating participant scores",
            detail: "Recalculating total score per attempt…",
          },
        ],
        `${unsaved.length} answer${unsaved.length === 1 ? "" : "s"} to save`,
      );
      try {
        advanceOverlay(1);
        const affectedAttempts = new Set<string>();
        const toGrade = unsaved.flatMap((answer) => {
          const g = rowGrades[answer.id];
          if (!g?.verdict) return [];
          const pts = g.customPoints ?? verdictPoints(g.verdict, answer.max_points);
          const msg = g.comment.trim();
          affectedAttempts.add(answer.attempt_id);
          return [{ answer, pts, msg }];
        });
        await Promise.all(
          toGrade.map(async ({ answer, pts, msg }) => {
            await supabase
              .from("quiz_answers")
              .update({
                points_awarded: pts,
                grader_comment: msg || null,
                graded_at: new Date().toISOString(),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any)
              .eq("id", answer.id);
            await handleGraded(answer.id, pts, msg);
          }),
        );
        advanceOverlay(2);
        await Promise.all(
          Array.from(affectedAttempts).map(async (attemptId) => {
            const { data: ptRows } = await supabase
              .from("quiz_answers")
              .select("points_awarded")
              .eq("attempt_id", attemptId);
            const newScore = (ptRows ?? []).reduce(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (s, r) => s + (((r as any).points_awarded as number) ?? 0),
              0,
            );
            await supabase.from("quiz_attempts").update({ score: newScore }).eq("id", attemptId);
          }),
        );
        finishOverlay();
        toast.success(`${unsaved.length} answer(s) saved!`);
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setSavingAll(false);
        setTimeout(hideOverlay, 400);
      }
    },
    [rowGrades, handleGraded, unlockedIds],
  );

  const handleFinalize = useCallback(async () => {
    setFinalizing(true);
    showOverlay(
      "Finalizing session",
      [
        {
          label: "Checking pending answers",
          detail: "Making sure every typed answer has been graded…",
        },
        {
          label: "Closing the session",
          detail: "Marking the session as completed in the database…",
        },
        { label: "Moving to history", detail: "Your session will appear in Quiz History." },
      ],
      "This usually takes 1–3 seconds",
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await supabase.rpc("finalize_session_grading" as any, {
      p_session_id: sessionId,
    });
    setFinalizing(false);
    const result = data as { still_pending?: boolean } | null;
    if (result?.still_pending) {
      hideOverlay();
      toast.info("Some answers are still pending grading.");
    } else {
      advanceOverlay(1);
      advanceOverlay(2);
      finishOverlay();
      toast.success("Session finalized, moved to quiz history!");
      setTimeout(() => {
        hideOverlay();
        void navigate({ to: "/quiz-history" });
      }, 500);
    }
  }, [sessionId, navigate]);

  const handleRunAi = useCallback(
    async (answer: GradeAnswer, criteriaNote: string): Promise<AiResult> => {
      if (!user) throw new Error("Not authenticated");
      const cost = answer.question_type === "long_answer" ? creditCostLong : creditCostShort;
      const { data: ok, error: deductErr } = await supabase.rpc("deduct_credits", {
        p_user_id: user.id,
        p_amount: cost,
        p_type: "ai_grading",
        p_description: `AI graded ${answer.question_type} answer`,
      });
      if (deductErr || !ok) throw new Error("Insufficient credits or deduction failed");
      reload();
      return gradeAnswerWithAi({
        data: {
          questionText: sanitizeForAi(answer.question_text, 500),
          questionType: answer.question_type,
          modelAnswer: answer.model_answer ? sanitizeForAi(answer.model_answer, 500) : "",
          rubric: sanitizeForAi(
            answer.rubric
              ? `${answer.rubric}\n\nEvaluate on: ${criteriaNote}`
              : `Evaluate on: ${criteriaNote}`,
            600,
          ),
          studentAnswer: sanitizeForAi(answer.answer_text ?? "", 2000),
          maxPoints: answer.max_points,
        },
      });
    },
    [user, creditCostShort, creditCostLong, reload],
  );

  const pending = answers.filter((a) => a.graded_at === null);
  const graded = answers.filter((a) => a.graded_at !== null);
  const totalCost = pending.reduce(
    (s, a) => s + (a.question_type === "long_answer" ? creditCostLong : creditCostShort),
    0,
  );

  const runAiGrade = async () => {
    if (!user) return;
    setMode("ai-running");
    setAiRunning(true);
    setAiProgress(0);
    const criteriaNote = buildCriteriaNote(criteria);
    showOverlay(
      "AI is grading your answers",
      [
        {
          label: "Deducting credits",
          detail: `${totalCost} credits for ${pending.length} answer${pending.length === 1 ? "" : "s"}`,
        },
        {
          label: "Sending answers to Claude",
          detail: "Sanitising input and bundling questions, model answers, rubrics…",
        },
        {
          label: "Receiving AI evaluations",
          detail: "Each answer is scored against your criteria, this is the longest step.",
        },
        {
          label: "Preparing review",
          detail: "Building the review screen so you can adjust marks before saving…",
        },
      ],
      `${pending.length} answer${pending.length === 1 ? "" : "s"} · ~${Math.max(5, pending.length * 2)}s`,
    );

    try {
      const { data: ok, error: deductErr } = await supabase.rpc("deduct_credits", {
        p_user_id: user.id,
        p_amount: totalCost,
        p_type: "ai_grading",
        p_description: `Batch AI grading: ${pending.length} answers`,
      });
      if (deductErr || !ok) {
        const detail = deductErr ? `: ${deductErr.message}` : "";
        toast.error(`Credit deduction failed${detail}`);
        setAiRunning(false);
        setMode("ai-setup");
        hideOverlay();
        return;
      }
      setAiProgress(20);
      advanceOverlay(1);
      advanceOverlay(2);

      const { results } = await gradeAllAnswersWithAi({
        data: {
          questions: pending.map((a) => ({
            id: a.id,
            questionText: sanitizeForAi(a.question_text, 500),
            questionType: a.question_type,
            studentAnswer: sanitizeForAi(a.answer_text ?? "", 2000),
            maxPoints: a.max_points,
            modelAnswer: a.model_answer ? sanitizeForAi(a.model_answer, 500) : undefined,
            rubric: sanitizeForAi(
              a.rubric
                ? `${a.rubric}\n\nEvaluate on: ${criteriaNote}`
                : `Evaluate on: ${criteriaNote}`,
              600,
            ),
          })),
        },
      });

      setAiProgress(90);
      advanceOverlay(3);
      setAiReviewItems(
        results.map((r) => {
          const answer = pending.find((a) => a.id === r.id)!;
          return { answer, result: r, adjustedPoints: r.points };
        }),
      );
      setAiProgress(100);
      finishOverlay();
      setAiRunning(false);
      setMode("ai-review");
      setTimeout(hideOverlay, 400);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(`AI grading failed: ${err?.message ?? "unknown error"}`);
      setAiRunning(false);
      setMode("select");
      hideOverlay();
    }
  };

  const confirmAiReview = async () => {
    setSavingReview(true);
    showOverlay(
      "Saving reviewed marks",
      [
        {
          label: "Writing graded answers",
          detail: `Saving ${aiReviewItems.length} answer${aiReviewItems.length === 1 ? "" : "s"} with the marks you confirmed…`,
        },
        { label: "Recomputing attempt scores", detail: "Updating each participant's total score…" },
      ],
      `${aiReviewItems.length} reviewed answer${aiReviewItems.length === 1 ? "" : "s"}`,
    );
    try {
      const affectedAttempts = new Set<string>();
      await Promise.all(
        aiReviewItems.map(async (item) => {
          const { error: upErr } = await supabase
            .from("quiz_answers")
            .update({
              points_awarded: item.adjustedPoints,
              grader_comment: item.result.comment || null,
              graded_at: new Date().toISOString(),
              graded_by_ai: true,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
            .eq("id", item.answer.id);
          if (upErr) return;
          affectedAttempts.add(item.answer.attempt_id);
          await handleGraded(item.answer.id, item.adjustedPoints, item.result.comment);
        }),
      );
      advanceOverlay(1);
      await Promise.all(
        Array.from(affectedAttempts).map(async (attemptId) => {
          const { data: pts } = await supabase
            .from("quiz_answers")
            .select("points_awarded")
            .eq("attempt_id", attemptId);
          const newScore = (pts ?? []).reduce(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (s, r) => s + (((r as any).points_awarded as number) ?? 0),
            0,
          );
          await supabase.from("quiz_attempts").update({ score: newScore }).eq("id", attemptId);
        }),
      );
      finishOverlay();
      reload();
      toast.success(`${aiReviewItems.length} answers saved!`);
      setAiReviewItems([]);
      setMode("select");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(`Save failed: ${err?.message ?? "unknown error"}`);
    } finally {
      setSavingReview(false);
      setTimeout(hideOverlay, 400);
    }
  };

  // Build question groups
  const questionGroups: QuestionGroup[] = [];
  for (const a of answers) {
    // react-doctor-disable-next-line react-doctor/js-index-maps
    let g = questionGroups.find((g) => g.question_id === a.question_id);
    if (!g) {
      g = {
        question_id: a.question_id,
        question_text: a.question_text,
        question_type: a.question_type,
        max_points: a.max_points,
        model_answer: a.model_answer,
        rubric: a.rubric,
        answers: [],
      };
      questionGroups.push(g);
    }
    g.answers.push(a);
  }

  return {
    answers,
    loading,
    sessionTitle,
    sessionStatus,
    mode,
    setMode,
    questionIndex,
    setQuestionIndex,
    rowGrades,
    setRowGrades,
    savingAll,
    unlockedIds,
    overlay,
    criteria,
    setCriteria,
    aiRunning,
    aiProgress,
    aiReviewItems,
    setAiReviewItems,
    savingReview,
    finalizing,
    creditCostShort,
    creditCostLong,
    credits,
    pending,
    graded,
    totalCost,
    questionGroups,
    isUnsavedForUI,
    getRowGrade,
    handleGraded,
    handleEditGrade,
    handleSaveAllGrades,
    handleFinalize,
    handleRunAi,
    runAiGrade,
    confirmAiReview,
  };
}
