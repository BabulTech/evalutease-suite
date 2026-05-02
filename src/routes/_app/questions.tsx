import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { HelpCircle, FileEdit, ScanLine, Sparkles, Upload } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { CategoryPanel } from "@/components/questions/CategoryPanel";
import { QuestionList } from "@/components/questions/QuestionList";
import { ManualTab } from "@/components/questions/ManualTab";
import { ScanTab } from "@/components/questions/ScanTab";
import { AiTab } from "@/components/questions/AiTab";
import { UploadTab } from "@/components/questions/UploadTab";
import {
  type Category,
  type DraftQuestion,
  type Question,
  type QuestionSource,
} from "@/components/questions/types";

export const Route = createFileRoute("/_app/questions")({ component: QuestionsPage });

function QuestionsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [categories, setCategories] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQs, setLoadingQs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("manual");

  const selected = useMemo(
    () => categories.find((c) => c.id === selectedId) ?? null,
    [categories, selectedId],
  );

  const loadCategories = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("question_categories")
      .select("id, name, subject, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    setCategories(data ?? []);
    setSelectedId((curr) => {
      if (curr && data?.some((c) => c.id === curr)) return curr;
      return data && data.length > 0 ? data[0].id : null;
    });
  }, [user]);

  const loadCounts = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("questions")
      .select("category_id")
      .eq("owner_id", user.id);
    if (error) return;
    const next: Record<string, number> = {};
    for (const row of data ?? []) {
      if (row.category_id) next[row.category_id] = (next[row.category_id] ?? 0) + 1;
    }
    setCounts(next);
  }, [user]);

  const loadQuestions = useCallback(
    async (categoryId: string) => {
      if (!user) return;
      setLoadingQs(true);
      const { data, error } = await supabase
        .from("questions")
        .select(
          "id, category_id, text, options, correct_answer, difficulty, explanation, source, created_at",
        )
        .eq("owner_id", user.id)
        .eq("category_id", categoryId)
        .order("created_at", { ascending: false });
      setLoadingQs(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setQuestions(
        (data ?? []).map((row) => ({
          id: row.id,
          category_id: row.category_id,
          text: row.text,
          options: Array.isArray(row.options) ? (row.options as string[]) : [],
          correct_answer: row.correct_answer ?? "",
          difficulty: row.difficulty,
          explanation: row.explanation,
          source: row.source,
          created_at: row.created_at,
        })),
      );
    },
    [user],
  );

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);
  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);
  useEffect(() => {
    if (selectedId) void loadQuestions(selectedId);
    else setQuestions([]);
  }, [selectedId, loadQuestions]);

  const createCategory = async (input: { name: string; subject: string | null }) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("question_categories")
      .insert({ owner_id: user.id, name: input.name, subject: input.subject })
      .select("id, name, subject, created_at")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      setCategories((prev) => [...prev, data]);
      setSelectedId(data.id);
      toast.success(`Created "${data.name}"`);
    }
  };

  const renameCategory = async (id: string, input: { name: string; subject: string | null }) => {
    const { error } = await supabase
      .from("question_categories")
      .update({ name: input.name, subject: input.subject })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: input.name, subject: input.subject } : c)),
    );
    toast.success("Category updated");
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from("question_categories").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setSelectedId((curr) => (curr === id ? null : curr));
    setCounts((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
    toast.success("Category deleted");
  };

  const saveDrafts = async (drafts: DraftQuestion[], source: QuestionSource) => {
    if (!user) return;
    if (!selectedId) {
      toast.error("Pick or create a category first");
      return;
    }
    setSaving(true);
    const rows = drafts.map((d) => ({
      owner_id: user.id,
      category_id: selectedId,
      text: d.text.trim(),
      type: "mcq" as const,
      difficulty: d.difficulty,
      options: d.options.map((o) => o.trim()),
      correct_answer: d.options[d.correctIndex]?.trim() ?? "",
      explanation: d.explanation.trim() || null,
      source,
    }));
    const { data, error } = await supabase
      .from("questions")
      .insert(rows)
      .select(
        "id, category_id, text, options, correct_answer, difficulty, explanation, source, created_at",
      );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const inserted = (data ?? []).map((row) => ({
      id: row.id,
      category_id: row.category_id,
      text: row.text,
      options: Array.isArray(row.options) ? (row.options as string[]) : [],
      correct_answer: row.correct_answer ?? "",
      difficulty: row.difficulty,
      explanation: row.explanation,
      source: row.source,
      created_at: row.created_at,
    })) as Question[];
    setQuestions((prev) => [...inserted, ...prev]);
    setCounts((prev) => ({ ...prev, [selectedId]: (prev[selectedId] ?? 0) + inserted.length }));
    toast.success(`${inserted.length} question${inserted.length === 1 ? "" : "s"} saved`);
  };

  const updateQuestion = async (id: string, draft: DraftQuestion) => {
    const update = {
      text: draft.text.trim(),
      difficulty: draft.difficulty,
      options: draft.options.map((o) => o.trim()),
      correct_answer: draft.options[draft.correctIndex]?.trim() ?? "",
      explanation: draft.explanation.trim() || null,
    };
    const { error } = await supabase.from("questions").update(update).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? { ...q, ...update, options: update.options, correct_answer: update.correct_answer }
          : q,
      ),
    );
    toast.success("Question updated");
  };

  const deleteQuestion = async (id: string) => {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    if (selectedId)
      setCounts((prev) => ({ ...prev, [selectedId]: Math.max(0, (prev[selectedId] ?? 1) - 1) }));
    toast.success("Question deleted");
  };

  const noCategory = selectedId === null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{t("nav.questions")}</h1>
          <p className="text-muted-foreground mt-1">
            Group questions into categories, then build them manually, by scanning images, with AI,
            or by uploading files.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
          <HelpCircle className="h-4 w-4" />
          MCQ · 1 correct answer · max 250 chars
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <CategoryPanel
          categories={categories}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreate={createCategory}
          onRename={renameCategory}
          onDelete={deleteCategory}
          questionCounts={counts}
        />

        <section className="flex-1 min-w-0 space-y-5">
          {noCategory ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
              <h3 className="font-display text-lg font-semibold">Pick a category to get started</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a category like <span className="font-medium text-foreground">History</span>,{" "}
                <span className="font-medium text-foreground">Science</span>,{" "}
                <span className="font-medium text-foreground">Sports</span>,{" "}
                <span className="font-medium text-foreground">Religion</span>, or an academic class
                like <span className="font-medium text-foreground">Class 5</span> to start adding
                questions.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-border bg-card/40 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Category
                    </div>
                    <div className="font-display text-lg font-bold">{selected?.name}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {counts[selectedId!] ?? 0} question{(counts[selectedId!] ?? 0) === 1 ? "" : "s"}
                  </div>
                </div>
              </div>

              <Tabs value={tab} onValueChange={setTab} className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
                  <TabsTrigger value="manual" className="gap-1.5 py-2">
                    <FileEdit className="h-4 w-4" /> Manual
                  </TabsTrigger>
                  <TabsTrigger value="scan" className="gap-1.5 py-2">
                    <ScanLine className="h-4 w-4" /> Scan Image
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="gap-1.5 py-2">
                    <Sparkles className="h-4 w-4" /> AI Generate
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="gap-1.5 py-2">
                    <Upload className="h-4 w-4" /> Upload File
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="manual">
                  <ManualTab disabled={saving} onSave={(d) => saveDrafts(d, "manual")} />
                </TabsContent>
                <TabsContent value="scan">
                  <ScanTab disabled={saving} saving={saving} onSave={(d) => saveDrafts(d, "ocr")} />
                </TabsContent>
                <TabsContent value="ai">
                  <AiTab disabled={saving} saving={saving} onSave={(d) => saveDrafts(d, "ai")} />
                </TabsContent>
                <TabsContent value="upload">
                  <UploadTab
                    disabled={saving}
                    saving={saving}
                    onSave={(d) => saveDrafts(d, "import")}
                  />
                </TabsContent>
              </Tabs>

              <div>
                <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Questions in this category
                </h3>
                <QuestionList
                  questions={questions}
                  loading={loadingQs}
                  onUpdate={updateQuestion}
                  onDelete={deleteQuestion}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
