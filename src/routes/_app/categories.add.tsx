import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, BookOpen, ChevronRight, FileEdit, FolderPlus,
  Plus, ScanLine, Sparkles, Upload, Check,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ManualTab } from "@/components/questions/ManualTab";
import { DEFAULT_TIME_SECONDS, type DraftQuestion, type QuestionSource } from "@/components/questions/types";
import { draftToRow } from "@/components/questions/persistence";

export const Route = createFileRoute("/_app/categories/add")({ component: AddQuestionPage });

const ScanTab = lazy(() =>
  import("@/components/questions/ScanTab").then((m) => ({ default: m.ScanTab })),
);
const AiTab = lazy(() =>
  import("@/components/questions/AiTab").then((m) => ({ default: m.AiTab })),
);
const UploadTab = lazy(() =>
  import("@/components/questions/UploadTab").then((m) => ({ default: m.UploadTab })),
);

type Cat = { id: string; name: string; icon: string | null };
type Sub = { id: string; category_id: string; name: string };
type Method = "manual" | "ai" | "scan" | "upload";

const METHODS: { id: Method; label: string; desc: string; icon: typeof FileEdit; accent: string }[] = [
  { id: "manual", label: "Manual",  desc: "Type questions yourself",       icon: FileEdit, accent: "border-primary/40 bg-primary/5 text-primary" },
  { id: "ai",     label: "AI",      desc: "Generate with Claude AI",       icon: Sparkles, accent: "border-purple-500/40 bg-purple-500/5 text-purple-400" },
  { id: "scan",   label: "Scan",    desc: "Extract from image or PDF",     icon: ScanLine, accent: "border-blue-500/40 bg-blue-500/5 text-blue-400" },
  { id: "upload", label: "Upload",  desc: "Import from file (CSV / JSON)", icon: Upload,   accent: "border-orange-500/40 bg-orange-500/5 text-orange-400" },
];

/* ── Quick-create dialog ── */
function QuickCreateDialog({
  open, onClose, title, placeholder, onConfirm,
}: {
  open: boolean; onClose: () => void; title: string; placeholder: string;
  onConfirm: (name: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!value.trim()) return;
    setBusy(true);
    try { await onConfirm(value.trim()); setValue(""); onClose(); } finally { setBusy(false); }
  };
  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setValue(""); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Name *</label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="h-11"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setValue(""); onClose(); }} disabled={busy}>{t("common.cancel")}</Button>
          <Button
            onClick={submit}
            disabled={busy || !value.trim()}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {busy ? t("cat.creating") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Chip selector ── */
function ChipSelector({
  items, selected, onSelect,
}: {
  items: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
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
          {selected === item.id && <Check size={12} />}
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ── Main page ── */
function AddQuestionPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [cats, setCats] = useState<Cat[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [selectedCat, setSelectedCat] = useState("");
  const [selectedSub, setSelectedSub] = useState("");
  const [method, setMethod] = useState<Method>("manual");
  const [saving, setSaving] = useState(false);
  const [catDialog, setCatDialog] = useState(false);
  const [subDialog, setSubDialog] = useState(false);

  const loadMeta = useCallback(async () => {
    if (!user) return;
    const [cRes, sRes] = await Promise.all([
      supabase.from("question_categories").select("id,name,icon").eq("owner_id", user.id).order("created_at"),
      supabase.from("question_subcategories").select("id,category_id,name").eq("owner_id", user.id).order("created_at"),
    ]);
    if (cRes.data) setCats(cRes.data);
    if (sRes.data) setSubs(sRes.data);
  }, [user]);

  useEffect(() => { void loadMeta(); }, [loadMeta]);

  const filteredSubs = useMemo(() => subs.filter((s) => s.category_id === selectedCat), [subs, selectedCat]);

  const createCat = async (name: string) => {
    if (!user) return;
    const { data, error } = await supabase.from("question_categories")
      .insert({ owner_id: user.id, name }).select("id").single();
    if (error) { toast.error(error.message); throw error; }
    toast.success(t("cat.categoryCreated").replace("{name}", name));
    setCats((prev) => [...prev, { id: data.id, name, icon: null }]);
    setSelectedCat(data.id);
    setSelectedSub("");
  };

  const createSub = async (name: string) => {
    if (!user || !selectedCat) return;
    const { data, error } = await supabase.from("question_subcategories")
      .insert({ owner_id: user.id, category_id: selectedCat, name }).select("id").single();
    if (error) { toast.error(error.message); throw error; }
    toast.success(t("cat.topicCreated").replace("{name}", name));
    setSubs((prev) => [...prev, { id: data.id, category_id: selectedCat, name }]);
    setSelectedSub(data.id);
  };

  const saveDrafts = async (drafts: DraftQuestion[], source: QuestionSource) => {
    if (!user || !selectedCat || !selectedSub) {
      toast.error(t("add.selectCatTopicFirst"));
      return;
    }
    setSaving(true);
    const rows = drafts.map((d) =>
      draftToRow(d, { ownerId: user.id, categoryId: selectedCat, subcategoryId: selectedSub, source }),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("questions").insert(rows as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} ${rows.length === 1 ? t("q.count") : t("q.counts")} ${t("q.saved")}`);
  };

  const selectedCatName = cats.find((c) => c.id === selectedCat)?.name ?? "";
  const selectedSubName = subs.find((s) => s.id === selectedSub)?.name ?? "";
  const ready = !!(selectedCat && selectedSub);

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-10">

      {/* ── Back + breadcrumb ── */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => navigate({ to: "/categories" })}
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> <BookOpen size={12} /> {t("add.backToQuestions")}
        </button>
      </div>

      {/* ── Page title ── */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">{t("add.title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("add.desc")}</p>
      </div>

      {/* ── STEP 1: Where does this question go? ── */}
      <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
        {/* Step label */}
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">1</div>
          <span className="text-sm font-semibold">Where should this question be saved?</span>
        </div>

        {/* Category chips */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("cat.category")}</label>
            <button
              type="button"
              onClick={() => setCatDialog(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
            >
              <FolderPlus size={12} /> New
            </button>
          </div>
          {cats.length === 0 ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-xs text-muted-foreground">No categories yet.</p>
              <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setCatDialog(true)}>
                <FolderPlus size={13} /> Create first category
              </Button>
            </div>
          ) : (
            <ChipSelector
              items={cats.map((c) => ({ id: c.id, label: c.name }))}
              selected={selectedCat}
              onSelect={(id) => { setSelectedCat(id); setSelectedSub(""); }}
            />
          )}
        </div>

        {/* Topic chips — only after category selected */}
        {selectedCat && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("cat.topic")} <span className="text-muted-foreground/60">in {selectedCatName}</span>
              </label>
              <button
                type="button"
                onClick={() => setSubDialog(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
              >
                <Plus size={12} /> New
              </button>
            </div>
            {filteredSubs.length === 0 ? (
              <div className="text-center py-3 space-y-2">
                <p className="text-xs text-muted-foreground">No topics in <span className="font-medium text-foreground">{selectedCatName}</span>.</p>
                <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setSubDialog(true)}>
                  <Plus size={13} /> Add first topic
                </Button>
              </div>
            ) : (
              <ChipSelector
                items={filteredSubs.map((s) => ({ id: s.id, label: s.name }))}
                selected={selectedSub}
                onSelect={setSelectedSub}
              />
            )}
          </div>
        )}

        {/* Destination confirmation pill */}
        {ready && (
          <div className="flex items-center gap-2 rounded-xl border border-success/25 bg-success/8 px-3 py-2.5">
            <Check size={14} className="text-success shrink-0" />
            <span className="text-xs text-muted-foreground">Saving to</span>
            <span className="text-xs font-semibold text-foreground">{selectedCatName}</span>
            <ChevronRight size={12} className="text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold text-primary">{selectedSubName}</span>
          </div>
        )}
      </div>

      {/* ── STEP 2: How do you want to add? (method cards) ── */}
      <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            ready ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>2</div>
          <span className={`text-sm font-semibold ${ready ? "" : "text-muted-foreground"}`}>
            How do you want to add questions?
          </span>
        </div>

        {/* Method cards — all visible, no dropdown (Hick's Law) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {METHODS.map((m) => {
            const Icon = m.icon;
            const active = method === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={`rounded-2xl border p-3 text-left transition-all min-h-[80px] flex flex-col justify-between ${
                  active ? m.accent + " ring-2 ring-inset ring-current/20" : "border-border bg-card/40 hover:border-primary/30"
                } ${!ready ? "opacity-50 pointer-events-none" : ""}`}
              >
                <Icon size={18} className={active ? "" : "text-muted-foreground"} />
                <div>
                  <div className={`text-sm font-semibold mt-2 ${active ? "" : "text-foreground"}`}>{m.label}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">{m.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Lock message when destination not selected */}
        {!ready && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            <span>↑ Pick a category and topic first to unlock this step</span>
          </div>
        )}

        {/* The active method content */}
        {ready && (
          <div className="pt-2 border-t border-border/50">
            {method === "manual" && (
              <ManualTab disabled={saving} onSave={(d) => saveDrafts(d, "manual")} />
            )}
            {method === "ai" && (
              <Suspense fallback={<TabLoading />}>
                <AiTab disabled={saving} saving={saving} onSave={(d) => saveDrafts(d, "ai")} />
              </Suspense>
            )}
            {method === "scan" && (
              <Suspense fallback={<TabLoading />}>
                <ScanTab disabled={saving} saving={saving} onSave={(d) => saveDrafts(d, "ocr")} />
              </Suspense>
            )}
            {method === "upload" && (
              <Suspense fallback={<TabLoading />}>
                <UploadTab disabled={saving} saving={saving} onSave={(d) => saveDrafts(d, "import")} />
              </Suspense>
            )}
          </div>
        )}
      </div>

      {/* Quick create dialogs */}
      <QuickCreateDialog
        open={catDialog}
        onClose={() => setCatDialog(false)}
        title={t("cat.newCategory")}
        placeholder={t("cat.namePlaceholder")}
        onConfirm={createCat}
      />
      <QuickCreateDialog
        open={subDialog}
        onClose={() => setSubDialog(false)}
        title={t("cat.newTopic")}
        placeholder={t("cat.namePlaceholder")}
        onConfirm={createSub}
      />
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
