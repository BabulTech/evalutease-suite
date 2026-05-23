import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import {
  DEFAULT_TIME_SECONDS,
  type DraftQuestion,
  type Question,
} from "@/components/questions/types";
import type { Cat, Sub } from "./types";
import type { User } from "@supabase/supabase-js";

export const QUESTION_PAGE_SIZE = 25;

export function useQuestionsPage(
  user: User | null,
  selectedSub: string,
  questionPage: number,
  search: string,
) {
  const { t } = useI18n();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionTotal, setQuestionTotal] = useState(0);
  const [loadingQs, setLoadingQs] = useState(false);
  const [usageCounts, setUsageCounts] = useState<Map<string, number>>(new Map());
  const [lastUsed, setLastUsed] = useState<Map<string, string>>(new Map());

  const loadQuestions = useCallback(async () => {
    if (!user || !selectedSub) {
      setQuestions([]);
      setQuestionTotal(0);
      return;
    }
    setLoadingQs(true);
    const from = questionPage * QUESTION_PAGE_SIZE;
    const to = from + QUESTION_PAGE_SIZE - 1;
    const searchTerm = search.trim();
    let query = supabase
      .from("questions")
      .select(
        "id,category_id,subcategory_id,text,options,correct_answer,difficulty,explanation,source,time_seconds,created_at",
        { count: "exact" },
      )
      .eq("owner_id", user.id)
      .eq("subcategory_id", selectedSub)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (searchTerm) query = query.ilike("text", `%${searchTerm}%`);
    const { data, error, count } = await query;
    setLoadingQs(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setQuestionTotal(count ?? 0);
    setQuestions(
      (data ?? []).map((row) => ({
        id: row.id,
        category_id: row.category_id,
        subcategory_id: row.subcategory_id,
        text: row.text,
        options: Array.isArray(row.options) ? (row.options as string[]) : [],
        correct_answer: row.correct_answer ?? "",
        difficulty: row.difficulty,
        explanation: row.explanation,
        source: row.source,
        time_seconds: row.time_seconds ?? DEFAULT_TIME_SECONDS,
        created_at: row.created_at,
      })),
    );
  }, [user, selectedSub, questionPage, search]);

  const loadUsage = useCallback(async () => {
    if (!user || !selectedSub) {
      setUsageCounts(new Map());
      setLastUsed(new Map());
      return;
    }
    const { data } = await supabase
      .from("quiz_session_questions")
      .select("question_id, quiz_sessions!inner(created_at, owner_id)")
      .eq("quiz_sessions.owner_id", user.id);
    if (!data) return;
    const counts = new Map<string, number>();
    const last = new Map<string, string>();
    for (const row of data) {
      const qid = row.question_id;
      counts.set(qid, (counts.get(qid) ?? 0) + 1);
      const ts = (row.quiz_sessions as unknown as { created_at: string }).created_at;
      if (!last.has(qid) || ts > last.get(qid)!) last.set(qid, ts);
    }
    setUsageCounts(counts);
    setLastUsed(last);
  }, [user, selectedSub]);

  useEffect(() => {
    void loadQuestions();
    void loadUsage();
  }, [loadQuestions, loadUsage]);

  const updateQuestion = async (id: string, draft: DraftQuestion) => {
    const base = {
      text: draft.text.trim(),
      difficulty: draft.difficulty,
      explanation: draft.explanation.trim() || null,
      time_seconds: draft.timeSeconds,
      max_points: draft.maxPoints,
      type: draft.type,
    };
    let update: Record<string, unknown>;
    if (draft.type === "mcq") {
      update = {
        ...base,
        options: draft.options.map((o) => o.trim()),
        correct_answer: draft.options[draft.correctIndex]?.trim() ?? "",
        acceptable_answers: null,
        model_answer: null,
        rubric: null,
      };
    } else if (draft.type === "true_false") {
      update = {
        ...base,
        options: [],
        correct_answer: draft.correctValue ? "true" : "false",
        acceptable_answers: null,
        model_answer: null,
        rubric: null,
      };
    } else if (draft.type === "short_answer") {
      update = {
        ...base,
        options: [],
        correct_answer: draft.acceptableAnswers[0]?.trim() ?? "",
        acceptable_answers: draft.acceptableAnswers.flatMap((a) => {
          const x = a.trim();
          return x ? [x] : [];
        }),
        requires_manual_grading: draft.gradingMode === "manual",
        model_answer: null,
        rubric: null,
      };
    } else {
      update = {
        ...base,
        options: [],
        correct_answer: "",
        acceptable_answers: null,
        model_answer: draft.modelAnswer.trim() || null,
        rubric: draft.rubric.trim() || null,
        requires_manual_grading: draft.gradingMode === "manual",
      };
    }

    const { error } = await supabase
      .from("questions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- update payload shape validated upstream; cast needed for Supabase RejectExcessProperties
      .update(update as any)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...update } : q)));
    toast.success(t("q.updated"));
  };

  const deleteQuestion = async (id: string, onDeleted: (subId: string) => void) => {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    onDeleted(selectedSub);
    toast.success(t("q.deleted"));
  };

  return {
    questions,
    questionTotal,
    loadingQs,
    usageCounts,
    lastUsed,
    updateQuestion,
    deleteQuestion,
  };
}

export function useMetaLoader(user: User | null) {
  const [cats, setCats] = useState<Cat[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [subQuestionCounts, setSubQuestionCounts] = useState<Map<string, number>>(new Map());

  const loadMeta = useCallback(async () => {
    if (!user) return;
    const [cRes, sRes, qRes] = await Promise.all([
      supabase
        .from("question_categories")
        .select("id,name,icon")
        .eq("owner_id", user.id)
        .order("created_at"),
      supabase
        .from("question_subcategories")
        .select("id,category_id,name,description")
        .eq("owner_id", user.id)
        .order("created_at"),
      supabase.from("questions").select("subcategory_id").eq("owner_id", user.id),
    ]);
    if (cRes.data) setCats(cRes.data);
    if (sRes.data) setSubs(sRes.data);
    if (qRes.data) {
      const counts = new Map<string, number>();
      for (const q of qRes.data) {
        if (q.subcategory_id) counts.set(q.subcategory_id, (counts.get(q.subcategory_id) ?? 0) + 1);
      }
      setSubQuestionCounts(counts);
    }
  }, [user]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const catQuestionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const sub of subs) {
      const c = subQuestionCounts.get(sub.id) ?? 0;
      map.set(sub.category_id, (map.get(sub.category_id) ?? 0) + c);
    }
    return map;
  }, [subs, subQuestionCounts]);

  const totalQuestions = useMemo(
    () => Array.from(subQuestionCounts.values()).reduce((a, b) => a + b, 0),
    [subQuestionCounts],
  );

  return {
    cats,
    setCats,
    subs,
    setSubs,
    subQuestionCounts,
    setSubQuestionCounts,
    catQuestionCounts,
    totalQuestions,
  };
}
