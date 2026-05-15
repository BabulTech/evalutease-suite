import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen, FolderPlus, Plus, Search, X, ChevronRight, HelpCircle, Layers,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// ── Quick create dialog ────────────────────────────────────────────────────────
function QuickCreateDialog({
  open, onClose, mode, categoryId, onCreated,
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
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted/40 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">
              {mode === "category" ? t("cat.categoryName") : t("cat.topicName")} *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("cat.namePlaceholder")}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              className="h-11"
              autoFocus
            />
          </div>
          {mode === "subcategory" && (
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">{t("cat.descOptional")}</label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("cat.descPlaceholder")} className="h-11" />
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1 h-11 cursor-pointer" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            className="flex-1 h-11 bg-gradient-primary text-primary-foreground shadow-glow cursor-pointer"
            onClick={() => void submit()}
            disabled={saving || !name.trim()}
          >
            {saving ? t("cat.creating") : t("common.create")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Chip selector — replaces dropdown for Hick's Law compliance ────────────────
function ChipSelector({
  items, selected, onSelect, onAdd, addLabel, placeholder, disabled = false,
}: {
  items: { id: string; label: string; count?: number }[];
  selected: string;
  onSelect: (id: string) => void;
  onAdd?: () => void;
  addLabel?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  if (disabled) return null;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {items.length === 0 && placeholder && (
        <span className="text-sm text-muted-foreground italic">{placeholder}</span>
      )}
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium min-h-[40px] transition-all ${
            selected === item.id
              ? "bg-primary text-primary-foreground border-primary shadow-glow"
              : "bg-card/60 border-border text-foreground hover:border-primary/50 hover:bg-primary/5"
          }`}
        >
          {item.label}
          {item.count !== undefined && (
            <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-semibold ${
              selected === item.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {item.count}
            </span>
          )}
        </button>
      ))}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary min-h-[40px] transition-all"
        >
          <Plus size={14} /> {addLabel ?? "Add"}
        </button>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
function QuestionsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [cats, setCats] = useState<Cat[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subQuestionCounts, setSubQuestionCounts] = useState<Map<string, number>>(new Map());
  const [usageCounts, setUsageCounts] = useState<Map<string, number>>(new Map());
  const [lastUsed, setLastUsed] = useState<Map<string, string>>(new Map());

  const [selectedCat, setSelectedCat] = useState<string>("");
  const [selectedSub, setSelectedSub] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loadingQs, setLoadingQs] = useState(false);
  const [questionPage, setQuestionPage] = useState(0);
  const [questionTotal, setQuestionTotal] = useState(0);

  const [catDialog, setCatDialog] = useState(false);
  const [subDialog, setSubDialog] = useState(false);

  // load categories + subcategories + per-subcategory question counts
  const loadMeta = useCallback(async () => {
    if (!user) return;
    const [cRes, sRes, qRes] = await Promise.all([
      supabase.from("question_categories").select("id,name,icon").eq("owner_id", user.id).order("created_at"),
      supabase.from("question_subcategories").select("id,category_id,name,description").eq("owner_id", user.id).order("created_at"),
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

  const filteredSubs = useMemo(() => subs.filter((s) => s.category_id === selectedCat), [subs, selectedCat]);

  // Total question count per category (for chip badge)
  const catQuestionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const sub of subs) {
      const c = subQuestionCounts.get(sub.id) ?? 0;
      map.set(sub.category_id, (map.get(sub.category_id) ?? 0) + c);
    }
    return map;
  }, [subs, subQuestionCounts]);

  const totalQuestions = useMemo(() => Array.from(subQuestionCounts.values()).reduce((a, b) => a + b, 0), [subQuestionCounts]);

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
    setSubQuestionCounts((prev) => {
      const next = new Map(prev);
      next.set(selectedSub, Math.max(0, (next.get(selectedSub) ?? 1) - 1));
      return next;
    });
    toast.success(t("q.deleted"));
  };

  const selectedCatName = cats.find((c) => c.id === selectedCat)?.name ?? "";
  const selectedSubName = subs.find((s) => s.id === selectedSub)?.name ?? "";

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" /> {t("cat.manageQuestions")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {totalQuestions > 0
              ? `${totalQuestions} questions across ${cats.length} ${cats.length === 1 ? "category" : "categories"}`
              : t("cat.manageDesc")}
          </p>
        </div>
        <Button
          onClick={() => navigate({ to: "/categories/add" })}
          className="h-11 gap-2 bg-gradient-primary text-primary-foreground shadow-glow cursor-pointer"
        >
          <Plus className="h-4 w-4" /> {t("cat.addQuestion")}
        </Button>
      </div>

      {/* ── Step 1: Category chips ── */}
      <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Layers className="h-3.5 w-3.5" />
            {cats.length === 0 ? "No categories yet" : t("cat.category")}
          </div>
          {/* "New Category" is a labeled button (Fitts' Law + discoverability) */}
          <button
            type="button"
            onClick={() => setCatDialog(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
          >
            <FolderPlus size={13} /> New Category
          </button>
        </div>

        {cats.length === 0 ? (
          // Empty state — prompt to create first category
          <div className="text-center py-6 space-y-3">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Create a category to organise your questions</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCatDialog(true)}>
              <FolderPlus size={14} /> Create first category
            </Button>
          </div>
        ) : (
          // Category chips — all visible at once (Hick's Law, no dropdown scan)
          <ChipSelector
            items={cats.map((c) => ({ id: c.id, label: c.name, count: catQuestionCounts.get(c.id) ?? 0 }))}
            selected={selectedCat}
            onSelect={(id) => { setSelectedCat(id); setSelectedSub(""); setQuestions([]); }}
          />
        )}
      </div>

      {/* ── Step 2: Topic chips — only after category selected (progressive disclosure) ── */}
      {selectedCat && (
        <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <ChevronRight size={12} className="text-primary" />
              <span className="text-primary">{selectedCatName}</span>
              <span>→</span>
              {t("cat.topic")}
            </div>
            <button
              type="button"
              onClick={() => setSubDialog(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
            >
              <Plus size={13} /> New Topic
            </button>
          </div>

          {filteredSubs.length === 0 ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-sm text-muted-foreground">No topics in <span className="font-medium text-foreground">{selectedCatName}</span> yet</p>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setSubDialog(true)}>
                <Plus size={14} /> Add first topic
              </Button>
            </div>
          ) : (
            // Topic chips — all visible at once (Hick's Law)
            <ChipSelector
              items={filteredSubs.map((s) => ({ id: s.id, label: s.name, count: subQuestionCounts.get(s.id) ?? 0 }))}
              selected={selectedSub}
              onSelect={setSelectedSub}
            />
          )}
        </div>
      )}

      {/* ── Step 3: Questions — only after topic selected ── */}
      {selectedSub && (
        <div className="space-y-4">
          {/* Topic header + search + stats */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold flex-wrap">
                <span className="text-muted-foreground">{selectedCatName}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-primary">{selectedSubName}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {questionTotal} {questionTotal !== 1 ? t("q.counts") : t("q.count")}
                {search ? ` matching "${search}"` : ""}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => navigate({ to: "/categories/add" })}
              className="h-9 gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> {t("cat.addToTopic")}
            </Button>
          </div>

          {/* Stats strip — only shown when there are questions */}
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

          {/* Search — only visible once topic is selected (progressive disclosure, cognitive load) */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("cat.searchQuestions")}
              className="pl-9 h-11"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <QuestionList
            questions={questions}
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

      {/* ── Prompt when nothing selected yet ── */}
      {!selectedCat && cats.length > 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
          <HelpCircle className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="font-semibold text-sm">{t("cat.selectCategoryTitle")}</p>
          <p className="text-xs text-muted-foreground mt-1">Pick a category above to browse its questions</p>
        </div>
      )}

      {/* Quick create dialogs */}
      <QuickCreateDialog
        open={catDialog}
        onClose={() => setCatDialog(false)}
        mode="category"
        onCreated={(id, name) => {
          setCats((prev) => [...prev, { id, name, icon: null }]);
          setSelectedCat(id); setSelectedSub("");
        }}
      />
      <QuickCreateDialog
        open={subDialog}
        onClose={() => setSubDialog(false)}
        mode="subcategory"
        categoryId={selectedCat}
        onCreated={(id, name) => {
          setSubs((prev) => [...prev, { id, category_id: selectedCat, name, description: null }]);
          setSelectedSub(id);
        }}
      />
    </div>
  );
}
