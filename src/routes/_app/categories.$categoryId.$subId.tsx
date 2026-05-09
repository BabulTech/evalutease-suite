import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, FileEdit, FolderOpen, ScanLine, Sparkles, Upload } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ManualTab } from "@/components/questions/ManualTab";
import { ScanTab } from "@/components/questions/ScanTab";
import { AiTab } from "@/components/questions/AiTab";
import { UploadTab } from "@/components/questions/UploadTab";
import { QuestionList } from "@/components/questions/QuestionList";
import {
  DEFAULT_TIME_SECONDS,
  type DraftQuestion,
  type Question,
  type QuestionSource,
} from "@/components/questions/types";

export const Route = createFileRoute("/_app/categories/$categoryId/$subId")({
  component: SubCategoryQuestionsPage,
});

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
  const [category, setCategory] = useState<CatRow | null>(null);
  const [sub, setSub] = useState<SubRow | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQs, setLoadingQs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("manual");

  const load = useCallback(async () => {
    if (!user) return;
    setLoadingQs(true);
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
        )
        .eq("owner_id", user.id)
        .eq("subcategory_id", subId)
        .order("created_at", { ascending: false }),
    ]);
    setLoadingQs(false);
    if (cat.error) toast.error(cat.error.message);
    if (s.error) toast.error(s.error.message);
    if (qs.error) toast.error(qs.error.message);
    setCategory(cat.data ?? null);
    setSub(s.data ?? null);
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
  }, [user, categoryId, subId]);

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
    toast.success(`${inserted.length} question${inserted.length === 1 ? "" : "s"} saved`);
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
    toast.success("Question updated");
  };

  const deleteQuestion = async (id: string) => {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    toast.success("Question deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/categories" className="hover:text-foreground">
          All categories
        </Link>
        <ChevronLeft className="h-3 w-3 rotate-180" />
        <Link
          to="/categories/$categoryId"
          params={{ categoryId }}
          className="hover:text-foreground"
        >
          {category?.name ?? "Category"}
        </Link>
        <ChevronLeft className="h-3 w-3 rotate-180" />
        <span className="text-foreground">{sub?.name ?? "Topic"}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {sub?.name ?? "Topic"}
            </h1>
            {sub?.description && (
              <p className="text-muted-foreground mt-1 text-sm">{sub.description}</p>
            )}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {questions.length} question{questions.length === 1 ? "" : "s"}
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
          <UploadTab disabled={saving} saving={saving} onSave={(d) => saveDrafts(d, "import")} />
        </TabsContent>
      </Tabs>

      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Questions in this topic
        </h3>
        <QuestionList
          questions={questions}
          loading={loadingQs}
          onUpdate={updateQuestion}
          onDelete={deleteQuestion}
        />
      </div>
    </div>
  );
}
