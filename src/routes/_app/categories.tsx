import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen, FolderOpen, FolderPlus, Layers, Plus, Search, X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuestionList } from "@/components/questions/QuestionList";
import { DEFAULT_TIME_SECONDS, type DraftQuestion, type Question } from "@/components/questions/types";
import { PaginationControls } from "@/components/PaginationControls";

export const Route = createFileRoute("/_app/categories")({ component: CategoriesRoot });

const QUESTION_PAGE_SIZE = 25;

function CategoriesRoot() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onIndex = pathname === "/categories" || pathname === "/categories/";
  if (!onIndex) return <Outlet />;
  return <QuestionsPage />;
}

type Cat = { id: string; name: string; icon: string | null };
type Sub = { id: string; category_id: string; name: string; description: string | null };

// ── Inline dialog for quick category/subcategory creation ────────────────────
function QuickCreateDialog({
  open, onClose, mode,
  categoryId,
  onCreated,
}: {
  open: boolean; onClose: () => void;
  mode: "category" | "subcategory";
  categoryId?: string;
  onCreated: (id: string, name: string) => void;
}) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!name.trim() || !user) return;
    setSaving(true);
    if (mode === "category") {
      const { data, error } = await supabase.from("question_categories")
        .insert({ owner_id: user.id, name: name.trim() }).select("id").single();
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success(t("cat.categoryCreated").replace("{name}", name.trim()));
      onCreated(data.id, name.trim());
    } else {
      if (!categoryId) return;
      const { data, error } = await supabase.from("question_subcategories")
        .insert({ owner_id: user.id, category_id: categoryId, name: name.trim(), description: desc.trim() || null })
        .select("id").single();
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success(t("cat.topicCreated").replace("{name}", name.trim()));
      onCreated(data.id, name.trim());
    }
    setName(""); setDesc("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-elegant space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-base">
            {mode === "category" ? t("cat.newCategory") : t("cat.newTopic")}
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-muted/40 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              {mode === "category" ? t("cat.categoryName") : t("cat.topicName")} *
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("cat.namePlaceholder")}
              onKeyDown={(e) => e.key === "Enter" && void submit()} autoFocus />
          </div>
          {mode === "subcategory" && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">{t("cat.descOptional")}</label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("cat.descPlaceholder")} />
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1 cursor-pointer" onClick={onClose}>{t("common.cancel")}</Button>
          <Button className="flex-1 bg-gradient-primary text-primary-foreground shadow-glow cursor-pointer"
            onClick={() => void submit()} disabled={saving || !name.trim()}>
            {saving ? t("cat.creating") : t("common.create")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
function QuestionsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [cats, setCats] = useState<Cat[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [usageCounts, setUsageCounts] = useState<Map<string, number>>(new Map());
  const [lastUsed, setLastUsed] = useState<Map<string, string>>(new Map());

  const [selectedCat, setSelectedCat] = useState<string>("");
  const [selectedSub, setSelectedSub] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loadingQs, setLoadingQs] = useState(false);
  const [questionPage, setQuestionPage] = useState(0);
  const [questionTotal, setQuestionTotal] = useState(0);

  // dialog state
  const [catDialog, setCatDialog] = useState(false);
  const [subDialog, setSubDialog] = useState(false);

  // load categories + subcategories
  const loadMeta = useCallback(async () => {
    if (!user) return;
    const [cRes, sRes] = await Promise.all([
      supabase.from("question_categories").select("id,name,icon").eq("owner_id", user.id).order("created_at"),
      supabase.from("question_subcategories").select("id,category_id,name,description").eq("owner_id", user.id).order("created_at"),
    ]);
    if (cRes.data) setCats(cRes.data);
    if (sRes.data) setSubs(sRes.data);
  }, [user]);

  // load questions for selected subcategory
  const loadQuestions = useCallback(async () => {
    if (!user || !selectedSub) { setQuestions([]); setQuestionTotal(0); return; }
    setLoadingQs(true);
    const from = questionPage * QUESTION_PAGE_SIZE;
    const to = from + QUESTION_PAGE_SIZE - 1;
    const searchTerm = search.trim();
    let query = supabase
      .from("questions")
      .select("id,category_id,subcategory_id,text,options,correct_answer,difficulty,explanation,source,time_seconds,created_at", { count: "exact" })
      .eq("owner_id", user.id)
      .eq("subcategory_id", selectedSub)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (searchTerm) query = query.ilike("text", `%${searchTerm}%`);
    const { data, error, count } = await query;
    setLoadingQs(false);
    if (error) { toast.error(error.message); return; }
    setQuestionTotal(count ?? 0);
    setQuestions((data ?? []).map((row) => ({
      id: row.id, category_id: row.category_id, subcategory_id: row.subcategory_id,
      text: row.text, options: Array.isArray(row.options) ? (row.options as string[]) : [],
      correct_answer: row.correct_answer ?? "", difficulty: row.difficulty,
      explanation: row.explanation, source: row.source,
      time_seconds: row.time_seconds ?? DEFAULT_TIME_SECONDS, created_at: row.created_at,
    })));
  }, [user, selectedSub, questionPage, search]);

  // load usage stats
  const loadUsage = useCallback(async () => {
    if (!user || !selectedSub) { setUsageCounts(new Map()); setLastUsed(new Map()); return; }
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

  useEffect(() => { void loadMeta(); }, [loadMeta]);
  useEffect(() => { void loadQuestions(); void loadUsage(); }, [loadQuestions, loadUsage]);
  useEffect(() => { setQuestionPage(0); }, [selectedSub, search]);

  const filteredSubs = useMemo(() =>
    subs.filter((s) => s.category_id === selectedCat),
    [subs, selectedCat]);

  const filteredQuestions = questions;

  const updateQuestion = async (id: string, draft: DraftQuestion) => {
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
    toast.success(t("q.deleted"));
  };

  const selectedCatName = cats.find((c) => c.id === selectedCat)?.name ?? "";
  const selectedSubName = subs.find((s) => s.id === selectedSub)?.name ?? "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" /> {t("cat.manageQuestions")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("cat.manageDesc")}</p>
        </div>
        <Button
          onClick={() => navigate({ to: "/categories/add" })}
          className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow cursor-pointer"
        >
          <Plus className="h-4 w-4" /> {t("cat.addQuestion")}
        </Button>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Layers className="h-3.5 w-3.5" /> {t("cat.browseByCategory")}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Category select */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("cat.category")}</label>
            <p className="text-[10px] text-muted-foreground/70">{t("cat.categoryHint")}</p>
            <div className="flex gap-2">
              <Select value={selectedCat} onValueChange={(v) => { setSelectedCat(v); setSelectedSub(""); setQuestions([]); }}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t("cat.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" title="New category"
                onClick={() => setCatDialog(true)} className="shrink-0 cursor-pointer">
                <FolderPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Subcategory select */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{t("cat.topic")}</label>
            <p className="text-[10px] text-muted-foreground/70">{t("cat.topicHint")}</p>
            <div className="flex gap-2">
              <Select value={selectedSub} onValueChange={setSelectedSub} disabled={!selectedCat}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={selectedCat ? t("cat.selectTopic") : t("cat.pickCategoryFirst")} />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubs.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" title="New topic"
                disabled={!selectedCat}
                onClick={() => setSubDialog(true)} className="shrink-0 cursor-pointer">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Search within topic */}
        {selectedSub && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={t("cat.searchQuestions")} className="pl-9" />
          </div>
        )}
      </div>

      {/* Question list area */}
      {!selectedCat ? (
        <EmptyPrompt icon={FolderOpen} title={t("cat.selectCategoryTitle")} desc={t("cat.selectCategoryDesc")} />
      ) : !selectedSub ? (
        <EmptyPrompt icon={Layers} title={t("cat.selectTopicTitle")}
          desc={t("cat.selectTopicDesc").replace("{cat}", selectedCatName)} />
      ) : (
        <div className="space-y-4">
          {/* Topic header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{selectedCatName}</span>
                <span className="text-muted-foreground text-xs">→</span>
                <span className="font-semibold text-sm text-primary">{selectedSubName}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {questionTotal} {questionTotal !== 1 ? t("q.counts") : t("q.count")}
                {search ? ` ${t("cat.matching")} "${search}"` : ""}
              </p>
            </div>
            <Button size="sm" onClick={() => navigate({ to: "/categories/add" })}
              className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow cursor-pointer">
              <Plus className="h-3.5 w-3.5" /> {t("cat.addToTopic")}
            </Button>
          </div>

          {/* Usage stats summary */}
          {questionTotal > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
                <div className="font-display text-xl font-bold">{questionTotal}</div>
                <div className="text-xs text-muted-foreground">{t("cat.totalQuestions")}</div>
              </div>
              <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
                <div className="font-display text-xl font-bold">
                  {Array.from(usageCounts.entries()).filter(([id]) => questions.some((q) => q.id === id)).reduce((s, [, v]) => s + v, 0)}
                </div>
                <div className="text-xs text-muted-foreground">{t("cat.timesUsed")}</div>
              </div>
              <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
                <div className="font-display text-xl font-bold">
                  {questions.filter((q) => !usageCounts.has(q.id)).length}
                </div>
                <div className="text-xs text-muted-foreground">{t("cat.neverUsed")}</div>
              </div>
            </div>
          )}

          <QuestionList
            questions={filteredQuestions}
            loading={loadingQs}
            onUpdate={updateQuestion}
            onDelete={deleteQuestion}
            usageCounts={usageCounts}
            lastUsed={lastUsed}
          />
          <PaginationControls
            page={questionPage}
            pageSize={QUESTION_PAGE_SIZE}
            total={questionTotal}
            label="questions"
            onPageChange={setQuestionPage}
          />
        </div>
      )}

      {/* Quick create dialogs */}
      <QuickCreateDialog open={catDialog} onClose={() => setCatDialog(false)} mode="category"
        onCreated={(id, name) => {
          setCats((prev) => [...prev, { id, name, icon: null }]);
          setSelectedCat(id); setSelectedSub("");
        }} />
      <QuickCreateDialog open={subDialog} onClose={() => setSubDialog(false)} mode="subcategory"
        categoryId={selectedCat}
        onCreated={(id, name) => {
          setSubs((prev) => [...prev, { id, category_id: selectedCat, name, description: null }]);
          setSelectedSub(id);
        }} />
    </div>
  );
}

function EmptyPrompt({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center">
      <Icon className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
    </div>
  );
}
