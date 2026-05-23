import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { logClientActivity } from "@/lib/audit";
import {
  DEFAULT_TIME_SECONDS,
  type DraftQuestion,
  type Question,
  type QuestionSource,
} from "@/components/questions/types";
import { draftToRow } from "@/components/questions/persistence";
import type { User } from "@supabase/supabase-js";

const QUESTION_PAGE_SIZE = 25;

type SubRow = { id: string; category_id: string; name: string; description: string | null };
type CatRow = { id: string; name: string };

export { QUESTION_PAGE_SIZE };
export type { SubRow, CatRow };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToQuestion(row: any): Question {
  return {
    id: row.id,
    category_id: row.category_id,
    subcategory_id: row.subcategory_id,
    type: row.type as Question["type"],
    text: row.text,
    options: Array.isArray(row.options) ? (row.options as string[]) : [],
    correct_answer: row.correct_answer ?? "",
    difficulty: row.difficulty,
    acceptable_answers: row.acceptable_answers as string[] | null,
    model_answer: row.model_answer as string | null,
    rubric: row.rubric as string | null,
    max_points: row.max_points ?? 1,
    requires_manual_grading: row.requires_manual_grading ?? false,
    explanation: row.explanation,
    source: row.source,
    time_seconds: row.time_seconds ?? DEFAULT_TIME_SECONDS,
    created_at: row.created_at,
  };
}

const SELECT_COLS =
  "id, category_id, subcategory_id, type, text, options, correct_answer, acceptable_answers, model_answer, rubric, max_points, requires_manual_grading, difficulty, explanation, source, time_seconds, created_at";

export function useSubCategoryQuestions(
  user: User | null,
  categoryId: string,
  subId: string,
  page: number,
  onSaved: () => void,
) {
  const { t } = useI18n();

  const [category, setCategory] = useState<CatRow | null>(null);
  const [sub, setSub] = useState<SubRow | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQs, setLoadingQs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [questionTotal, setQuestionTotal] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadingQs(true);
    const from = page * QUESTION_PAGE_SIZE;
    const to = from + QUESTION_PAGE_SIZE - 1;
    const [cat, s, qs] = await Promise.all([
      supabase
        .from("question_categories")
        .select("id, name")
        .eq("id", categoryId)
        .eq("owner_id", user.id)
        .maybeSingle(),
      supabase
        .from("question_subcategories")
        .select("id, category_id, name, description")
        .eq("id", subId)
        .eq("owner_id", user.id)
        .maybeSingle(),
      supabase
        .from("questions")
        .select(SELECT_COLS, { count: "exact" })
        .eq("owner_id", user.id)
        .eq("subcategory_id", subId)
        .order("created_at", { ascending: false })
        .range(from, to),
    ]);
    setLoadingQs(false);
    if (cat.error) toast.error(cat.error.message);
    if (s.error) toast.error(s.error.message);
    if (qs.error) toast.error(qs.error.message);
    setCategory(cat.data ?? null);
    setSub(s.data ?? null);
    const total = qs.count ?? 0;
    setQuestionTotal(total);
    setQuestions((qs.data ?? []).map(rowToQuestion));
    return total;
  }, [user, categoryId, subId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveDrafts = async (drafts: DraftQuestion[], source: QuestionSource) => {
    if (!user) return;
    setSaving(true);
    await supabase.auth.getSession();
    const rows = drafts.map((d) =>
      draftToRow(d, { ownerId: user.id, categoryId, subcategoryId: subId, source }),
    );
    const { data, error } = await supabase
      .from("questions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(rows as any)
      .select(SELECT_COLS);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const inserted = (data ?? []).map(rowToQuestion);
    setQuestions((prev) => [...inserted, ...prev]);
    setQuestionTotal((prev) => prev + inserted.length);
    const methodLabel =
      source === "manual"
        ? "manually"
        : source === "ai"
          ? "with AI"
          : source === "ocr"
            ? "from scan"
            : "from upload";
    void logClientActivity({
      actionType: "created",
      module: "questions",
      entityType: inserted.length === 1 ? "question" : "question_batch",
      entityId: inserted[0]?.id ?? null,
      entityLabel:
        inserted.length === 1 ? inserted[0]?.text?.slice(0, 120) : `${inserted.length} questions`,
      message: `Created ${inserted.length} question${inserted.length === 1 ? "" : "s"} ${methodLabel}`,
      details: {
        source,
        count: inserted.length,
        category_id: categoryId,
        topic_id: subId,
        question_ids: inserted.map((q) => q.id),
      },
      riskScore: inserted.length >= 50 ? 45 : inserted.length >= 20 ? 25 : 5,
    });
    toast.success(
      `${inserted.length} ${inserted.length === 1 ? t("q.count") : t("q.counts")} ${t("q.saved")}`,
    );
    if (inserted.length > 0) onSaved();
  };

  const updateQuestion = async (id: string, draft: DraftQuestion) => {
    let update: Record<string, unknown> = {
      text: draft.text.trim(),
      difficulty: draft.difficulty,
      explanation: draft.explanation.trim() || null,
      time_seconds: draft.timeSeconds,
      max_points: draft.maxPoints,
      type: draft.type,
    };
    if (draft.type === "mcq") {
      update = {
        ...update,
        options: draft.options.map((o) => o.trim()),
        correct_answer: draft.options[draft.correctIndex]?.trim() ?? "",
        acceptable_answers: null,
        model_answer: null,
        rubric: null,
      };
    } else if (draft.type === "true_false") {
      update = {
        ...update,
        options: ["true", "false"],
        correct_answer: draft.correctValue ? "true" : "false",
        acceptable_answers: null,
        model_answer: null,
        rubric: null,
      };
    } else if (draft.type === "short_answer") {
      const answers = draft.acceptableAnswers.filter((a) => a.trim());
      update = {
        ...update,
        options: [],
        correct_answer: answers[0] ?? "",
        acceptable_answers: answers,
        requires_manual_grading: draft.requiresManualGrading,
        model_answer: null,
        rubric: null,
      };
    } else if (draft.type === "long_answer") {
      update = {
        ...update,
        options: [],
        correct_answer: draft.modelAnswer.trim(),
        acceptable_answers: null,
        model_answer: draft.modelAnswer.trim() || null,
        rubric: draft.rubric.trim() || null,
        requires_manual_grading: true,
      };
    }
    const { error } = await supabase
      .from("questions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(update as any)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...(update as any) } : q)));
    void logClientActivity({
      actionType: "updated",
      module: "questions",
      entityType: "question",
      entityId: id,
      entityLabel: (update.text as string).slice(0, 120),
      message: "Updated question",
      details: { category_id: categoryId, topic_id: subId },
      riskScore: 5,
    });
    toast.success(t("q.updated"));
  };

  const deleteQuestion = async (id: string) => {
    const target = questions.find((q) => q.id === id);
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    setQuestionTotal((prev) => Math.max(0, prev - 1));
    void logClientActivity({
      actionType: "deleted",
      module: "questions",
      entityType: "question",
      entityId: id,
      entityLabel: target?.text?.slice(0, 120) ?? "Question",
      message: "Deleted question",
      details: { category_id: categoryId, topic_id: subId },
      riskScore: 35,
    });
    toast.success(t("q.deleted"));
  };

  return {
    category,
    sub,
    questions,
    loadingQs,
    saving,
    questionTotal,
    saveDrafts,
    updateQuestion,
    deleteQuestion,
  };
}
