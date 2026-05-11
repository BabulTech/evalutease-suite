import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, FileEdit, FolderOpen, ScanLine, Sparkles, Upload } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ManualTab } from "@/components/questions/ManualTab";
import { QuestionList } from "@/components/questions/QuestionList";
import { PaginationControls } from "@/components/PaginationControls";
import { useI18n } from "@/lib/i18n";
import {
  DEFAULT_TIME_SECONDS,
  type DraftQuestion,
  type Question,
  type QuestionSource,
} from "@/components/questions/types";

export const Route = createFileRoute("/_app/categories/$categoryId/$subId")({
  component: SubCategoryQuestionsPage,
});

const QUESTION_PAGE_SIZE = 25;

const ScanTab = lazy(() =>
  import("@/components/questions/ScanTab").then((module) => ({ default: module.ScanTab })),
);
const AiTab = lazy(() =>
  import("@/components/questions/AiTab").then((module) => ({ default: module.AiTab })),
);
const UploadTab = lazy(() =>
  import("@/components/questions/UploadTab").then((module) => ({ default: module.UploadTab })),
);

type SubRow = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
};

type CatRow = { id: string; name: string };

function SubCategoryQuestionsPage() {
  const { categoryId, subId } = Route.useParams();
  const { user } = useAuth();
  const { t } = useI18n();
  const [category, setCategory] = useState<CatRow | null>(null);
  const [sub, setSub] = useState<SubRow | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQs, setLoadingQs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("manual");
  const [page, setPage] = useState(0);
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
        .select(
          "id, category_id, subcategory_id, text, options, correct_answer, difficulty, explanation, source, time_seconds, created_at",
          { count: "exact" },
        )
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
    setQuestionTotal(qs.count ?? 0);
    setQuestions(
      (qs.data ?? []).map((row) => ({
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
  }, [user, categoryId, subId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveDrafts = async (drafts: DraftQuestion[], source: QuestionSource) => {
    if (!user) return;
    setSaving(true);
    const rows = drafts.map((d) => ({
      owner_id: user.id,
      category_id: categoryId,
      subcategory_id: subId,
      text: d.text.trim(),
      type: "mcq" as const,
      difficulty: d.difficulty,
      options: d.options.map((o) => o.trim()),
      correct_answer: d.options[d.correctIndex]?.trim() ?? "",
      explanation: d.explanation.trim() || null,
      source,
      time_seconds: d.timeSeconds,
    }));
    const { data, error } = await supabase
      .from("questions")
      .insert(rows)
      .select(
        "id, category_id, subcategory_id, text, options, correct_answer, difficulty, explanation, source, time_seconds, created_at",
      );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const inserted = (data ?? []).map((row): Question => ({
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
    }));
    setQuestions((prev) => [...inserted, ...prev]);
    toast.success(`${inserted.length} ${inserted.length === 1 ? t("q.count") : t("q.counts")} ${t("q.saved")}`);
  };

  const updateQuestion = async (id: string, draft: DraftQuestion) => {
    const update = {
      text: draft.text.trim(),
      difficulty: draft.difficulty,
      options: draft.options.map((o) => o.trim()),
      correct_answer: draft.options[draft.correctIndex]?.trim() ?? "",
      explanation: draft.explanation.trim() || null,
      time_seconds: draft.timeSeconds,
    };
    const { error } = await supabase.from("questions").update(update).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              ...update,
              options: update.options,
              correct_answer: update.correct_answer,
            }
          : q,
      ),
    );
    toast.success(t("q.updated"));
  };

  const deleteQuestion = async (id: string) => {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    toast.success(t("q.deleted"));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/categories" className="hover:text-foreground">
          {t("q.allCategories")}
        </Link>
        <ChevronLeft className="h-3 w-3 rotate-180" />
        <Link
          to="/categories/$categoryId"
          params={{ categoryId }}
          className="hover:text-foreground"
        >
          {category?.name ?? t("q.category")}
        </Link>
        <ChevronLeft className="h-3 w-3 rotate-180" />
        <span className="text-foreground">{sub?.name ?? t("q.topic")}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {sub?.name ?? t("q.topic")}
            </h1>
            {sub?.description && (
              <p className="text-muted-foreground mt-1 text-sm">{sub.description}</p>
            )}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {questionTotal} {questionTotal === 1 ? t("q.count") : t("q.counts")}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
          <TabsTrigger value="manual" className="gap-1.5 py-2">
            <FileEdit className="h-4 w-4" /> {t("q.tabManual")}
          </TabsTrigger>
          <TabsTrigger value="scan" className="gap-1.5 py-2">
            <ScanLine className="h-4 w-4" /> {t("q.tabScan")}
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5 py-2">
            <Sparkles className="h-4 w-4" /> {t("q.tabAI")}
          </TabsTrigger>
          <TabsTrigger value="upload" className="gap-1.5 py-2">
            <Upload className="h-4 w-4" /> {t("q.tabUpload")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <ManualTab disabled={saving} onSave={(d) => saveDrafts(d, "manual")} />
        </TabsContent>
        <TabsContent value="scan">
          <Suspense fallback={<TabLoading />}>
            <ScanTab disabled={saving} saving={saving} onSave={(d) => saveDrafts(d, "ocr")} />
          </Suspense>
        </TabsContent>
        <TabsContent value="ai">
          <Suspense fallback={<TabLoading />}>
            <AiTab disabled={saving} saving={saving} onSave={(d) => saveDrafts(d, "ai")} />
          </Suspense>
        </TabsContent>
        <TabsContent value="upload">
          <Suspense fallback={<TabLoading />}>
            <UploadTab disabled={saving} saving={saving} onSave={(d) => saveDrafts(d, "import")} />
          </Suspense>
        </TabsContent>
      </Tabs>

      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {t("q.questionsInTopic")}
        </h3>
        <QuestionList
          questions={questions}
          loading={loadingQs}
          onUpdate={updateQuestion}
          onDelete={deleteQuestion}
        />
        <PaginationControls
          page={page}
          pageSize={QUESTION_PAGE_SIZE}
          total={questionTotal}
          label="questions"
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

function TabLoading() {
  const { t } = useI18n();
  return <div className="rounded-xl border border-border bg-card/30 p-6 text-sm text-muted-foreground">{t("common.loading")}</div>;
}
