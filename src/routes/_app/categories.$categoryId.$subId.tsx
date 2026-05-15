import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft, FileEdit, FolderOpen, ScanLine, Sparkles, Upload,
  Plus, ChevronDown, ChevronUp, HelpCircle, BookOpen,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ManualTab } from "@/components/questions/ManualTab";
import { QuestionList } from "@/components/questions/QuestionList";
import { PaginationControls } from "@/components/PaginationControls";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_TIME_SECONDS,
  type DraftQuestion,
  type Question,
  type QuestionSource,
} from "@/components/questions/types";
import { draftToRow } from "@/components/questions/persistence";

export const Route = createFileRoute("/_app/categories/$categoryId/$subId")({
  component: SubCategoryQuestionsPage,
});

const QUESTION_PAGE_SIZE = 25;

const ScanTab = lazy(() =>
  import("@/components/questions/ScanTab").then((m) => ({ default: m.ScanTab })),
);
const AiTab = lazy(() =>
  import("@/components/questions/AiTab").then((m) => ({ default: m.AiTab })),
);
const UploadTab = lazy(() =>
  import("@/components/questions/UploadTab").then((m) => ({ default: m.UploadTab })),
);

type SubRow = { id: string; category_id: string; name: string; description: string | null };
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

  // Add panel is collapsed by default when there are questions, open when empty
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadingQs(true);
    const from = page * QUESTION_PAGE_SIZE;
    const to = from + QUESTION_PAGE_SIZE - 1;
    const [cat, s, qs] = await Promise.all([
      supabase.from("question_categories").select("id, name").eq("id", categoryId).eq("owner_id", user.id).maybeSingle(),
      supabase.from("question_subcategories").select("id, category_id, name, description").eq("id", subId).eq("owner_id", user.id).maybeSingle(),
      supabase.from("questions")
        .select("id, category_id, subcategory_id, text, options, correct_answer, difficulty, explanation, source, time_seconds, created_at", { count: "exact" })
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
    // Auto-open add panel if topic is empty
    setAddOpen((prev) => (total === 0 ? true : prev));
    setQuestions(
      (qs.data ?? []).map((row) => ({
        id: row.id, category_id: row.category_id, subcategory_id: row.subcategory_id,
        text: row.text, options: Array.isArray(row.options) ? (row.options as string[]) : [],
        correct_answer: row.correct_answer ?? "", difficulty: row.difficulty,
        explanation: row.explanation, source: row.source,
        time_seconds: row.time_seconds ?? DEFAULT_TIME_SECONDS, created_at: row.created_at,
      })),
    );
  }, [user, categoryId, subId, page]);

  useEffect(() => { void load(); }, [load]);

  const saveDrafts = async (drafts: DraftQuestion[], source: QuestionSource) => {
    if (!user) return;
    setSaving(true);
    const rows = drafts.map((d) => draftToRow(d, { ownerId: user.id, categoryId, subcategoryId: subId, source }));
    const { data, error } = await supabase.from("questions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(rows as any)
      .select("id, category_id, subcategory_id, text, options, correct_answer, difficulty, explanation, source, time_seconds, created_at");
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    const inserted = (data ?? []).map((row): Question => ({
      id: row.id, category_id: row.category_id, subcategory_id: row.subcategory_id,
      text: row.text, options: Array.isArray(row.options) ? (row.options as string[]) : [],
      correct_answer: row.correct_answer ?? "", difficulty: row.difficulty,
      explanation: row.explanation, source: row.source,
      time_seconds: row.time_seconds ?? DEFAULT_TIME_SECONDS, created_at: row.created_at,
    }));
    setQuestions((prev) => [...inserted, ...prev]);
    setQuestionTotal((prev) => prev + inserted.length);
    toast.success(`${inserted.length} ${inserted.length === 1 ? t("q.count") : t("q.counts")} ${t("q.saved")}`);
    // Collapse add panel after saving so user sees the new questions
    if (inserted.length > 0) setAddOpen(false);
  };

  const updateQuestion = async (id: string, draft: DraftQuestion) => {
    if (draft.type !== "mcq") { toast.error("Editing non-MCQ questions is not supported yet"); return; }
    const update = {
      text: draft.text.trim(), difficulty: draft.difficulty,
      options: draft.options.map((o) => o.trim()),
      correct_answer: draft.options[draft.correctIndex]?.trim() ?? "",
      explanation: draft.explanation.trim() || null, time_seconds: draft.timeSeconds,
    };
    const { error } = await supabase.from("questions").update(update).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setQuestions((prev) => prev.map((q) => q.id === id ? { ...q, ...update } : q));
    toast.success(t("q.updated"));
  };

  const deleteQuestion = async (id: string) => {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    setQuestionTotal((prev) => Math.max(0, prev - 1));
    toast.success(t("q.deleted"));
  };

  // Difficulty breakdown for the stats bar
  const diffBreakdown = {
    easy:   questions.filter((q) => q.difficulty === "easy").length,
    medium: questions.filter((q) => q.difficulty === "medium").length,
    hard:   questions.filter((q) => q.difficulty === "hard").length,
  };

  return (
    <div className="space-y-4">

      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
        <Link to="/categories" className="hover:text-foreground transition-colors flex items-center gap-1">
          <BookOpen size={12} /> {t("q.allCategories")}
        </Link>
        <ChevronLeft className="h-3 w-3 rotate-180 shrink-0" />
        <Link to="/categories/$categoryId" params={{ categoryId }} className="hover:text-foreground transition-colors">
          {category?.name ?? t("q.category")}
        </Link>
        <ChevronLeft className="h-3 w-3 rotate-180 shrink-0" />
        <span className="text-foreground font-medium">{sub?.name ?? t("q.topic")}</span>
      </nav>

      {/* ── Hero header ── */}
      <div className="rounded-2xl border border-border bg-card/60 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight truncate">
              {sub?.name ?? t("q.topic")}
            </h1>
            {sub?.description && (
              <p className="text-muted-foreground text-sm mt-0.5 line-clamp-1">{sub.description}</p>
            )}
          </div>
        </div>

        {/* Stats badges */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3 py-1.5">
            <HelpCircle size={13} className="text-primary" />
            <span className="text-sm font-bold">{questionTotal}</span>
            <span className="text-xs text-muted-foreground">{questionTotal === 1 ? "question" : "questions"}</span>
          </div>
          {questionTotal > 0 && (
            <div className="hidden sm:flex items-center gap-1 rounded-xl border border-border bg-muted/30 px-3 py-1.5 gap-2">
              {diffBreakdown.easy > 0 && <span className="text-xs font-semibold text-success">{diffBreakdown.easy}E</span>}
              {diffBreakdown.medium > 0 && <span className="text-xs font-semibold text-primary">{diffBreakdown.medium}M</span>}
              {diffBreakdown.hard > 0 && <span className="text-xs font-semibold text-destructive">{diffBreakdown.hard}H</span>}
            </div>
          )}
          {/* Primary CTA — add questions (Fitts' Law) */}
          <Button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="h-10 gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {addOpen ? <ChevronUp size={15} /> : <Plus size={15} />}
            {addOpen ? "Hide" : "Add Questions"}
          </Button>
        </div>
      </div>

      {/* ── Add Questions Panel (collapsible, progressive disclosure) ── */}
      {addOpen && (
        <div className="rounded-2xl border border-primary/25 bg-primary/3 overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">Add New Questions</p>
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <div className="px-4">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto rounded-xl">
                <TabsTrigger value="manual" className="gap-1.5 py-2.5 text-xs sm:text-sm rounded-lg">
                  <FileEdit className="h-4 w-4" /> {t("q.tabManual")}
                </TabsTrigger>
                <TabsTrigger value="ai" className="gap-1.5 py-2.5 text-xs sm:text-sm rounded-lg">
                  <Sparkles className="h-4 w-4" /> {t("q.tabAI")}
                </TabsTrigger>
                <TabsTrigger value="scan" className="gap-1.5 py-2.5 text-xs sm:text-sm rounded-lg">
                  <ScanLine className="h-4 w-4" /> {t("q.tabScan")}
                </TabsTrigger>
                <TabsTrigger value="upload" className="gap-1.5 py-2.5 text-xs sm:text-sm rounded-lg">
                  <Upload className="h-4 w-4" /> {t("q.tabUpload")}
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="p-4">
              <TabsContent value="manual" className="mt-0">
                <ManualTab disabled={saving} onSave={(d) => saveDrafts(d, "manual")} />
              </TabsContent>
              <TabsContent value="ai" className="mt-0">
                <Suspense fallback={<TabLoading />}>
                  <AiTab disabled={saving} saving={saving} onSave={(d) => saveDrafts(d, "ai")} />
                </Suspense>
              </TabsContent>
              <TabsContent value="scan" className="mt-0">
                <Suspense fallback={<TabLoading />}>
                  <ScanTab disabled={saving} saving={saving} onSave={(d) => saveDrafts(d, "ocr")} />
                </Suspense>
              </TabsContent>
              <TabsContent value="upload" className="mt-0">
                <Suspense fallback={<TabLoading />}>
                  <UploadTab disabled={saving} saving={saving} onSave={(d) => saveDrafts(d, "import")} />
                </Suspense>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      )}

      {/* ── Questions list — PRIMARY content (user mental model: see what I have) ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("q.questionsInTopic")}
          </h2>
          {questionTotal > QUESTION_PAGE_SIZE && (
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {Math.ceil(questionTotal / QUESTION_PAGE_SIZE)}
            </span>
          )}
        </div>

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
          onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
        />
      </div>
    </div>
  );
}

function TabLoading() {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-border bg-card/30 p-6 text-sm text-muted-foreground">
      {t("common.loading")}
    </div>
  );
}
