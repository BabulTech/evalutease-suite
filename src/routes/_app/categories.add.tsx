import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, FileEdit, FolderPlus, Plus, ScanLine, Sparkles, Upload, X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ManualTab } from "@/components/questions/ManualTab";
import { DEFAULT_TIME_SECONDS, type DraftQuestion, type QuestionSource } from "@/components/questions/types";

export const Route = createFileRoute("/_app/categories/add")({ component: AddQuestionPage });

const ScanTab = lazy(() =>
  import("@/components/questions/ScanTab").then((module) => ({ default: module.ScanTab })),
);
const AiTab = lazy(() =>
  import("@/components/questions/AiTab").then((module) => ({ default: module.AiTab })),
);
const UploadTab = lazy(() =>
  import("@/components/questions/UploadTab").then((module) => ({ default: module.UploadTab })),
);

type Cat = { id: string; name: string; icon: string | null };
type Sub = { id: string; category_id: string; name: string };

/* ── Quick-create dialog ── */
function QuickCreateDialog({
  open, onClose, title, placeholder, onConfirm,
}: {
  open: boolean; onClose: () => void; title: string; placeholder: string;
  onConfirm: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!value.trim()) { toast.error("Name is required"); return; }
    setBusy(true);
    try { await onConfirm(value.trim()); setValue(""); onClose(); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setValue(""); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div>
          <Label className="mb-1.5">Name</Label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder}
            autoFocus onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setValue(""); onClose(); }} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !value.trim()}
            className="bg-gradient-primary text-primary-foreground shadow-glow">
            {busy ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main page ── */
function AddQuestionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [cats, setCats] = useState<Cat[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [selectedCat, setSelectedCat] = useState("");
  const [selectedSub, setSelectedSub] = useState("");
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
    toast.success(`Category "${name}" created`);
    setCats((prev) => [...prev, { id: data.id, name, icon: null }]);
    setSelectedCat(data.id);
    setSelectedSub("");
  };

  const createSub = async (name: string) => {
    if (!user || !selectedCat) return;
    const { data, error } = await supabase.from("question_subcategories")
      .insert({ owner_id: user.id, category_id: selectedCat, name }).select("id").single();
    if (error) { toast.error(error.message); throw error; }
    toast.success(`Sub-category "${name}" created`);
    setSubs((prev) => [...prev, { id: data.id, category_id: selectedCat, name }]);
    setSelectedSub(data.id);
  };

  const saveDrafts = async (drafts: DraftQuestion[], source: QuestionSource) => {
    if (!user || !selectedCat || !selectedSub) {
      toast.error("Select a category and sub-category first");
      return;
    }
    setSaving(true);
    const rows = drafts.map((d) => ({
      owner_id: user.id, category_id: selectedCat, subcategory_id: selectedSub,
      text: d.text.trim(), type: "mcq" as const, difficulty: d.difficulty,
      options: d.options.map((o) => o.trim()),
      correct_answer: d.options[d.correctIndex]?.trim() ?? "",
      explanation: d.explanation.trim() || null, source, time_seconds: d.timeSeconds,
    }));
    const { error } = await supabase.from("questions").insert(rows);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} question${rows.length === 1 ? "" : "s"} saved`);
  };

  const selectedCatName = cats.find((c) => c.id === selectedCat)?.name ?? "";
  const selectedSubName = subs.find((s) => s.id === selectedSub)?.name ?? "";
  const ready = !!(selectedCat && selectedSub);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back + header */}
      <div>
        <button
          type="button"
          onClick={() => navigate({ to: "/categories" })}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to questions
        </button>
        <h1 className="font-display text-3xl font-bold tracking-tight">Add Questions</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose a category and sub-category, then add questions manually, by AI, by scan, or by uploading a file.
        </p>
      </div>

      {/* Step 1 — Group selector */}
      <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Step 1 — Choose category
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 text-sm">Category</Label>
            <div className="flex gap-1">
              <Select value={selectedCat} onValueChange={(v) => { setSelectedCat(v); setSelectedSub(""); }}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" title="New category"
                onClick={() => setCatDialog(true)}>
                <FolderPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 text-sm">
              Sub-category <span className="text-muted-foreground font-normal text-xs">(required)</span>
            </Label>
            <div className="flex gap-1">
              <Select value={selectedSub} onValueChange={setSelectedSub} disabled={!selectedCat}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={selectedCat ? "Select sub-category" : "Pick category first"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubs.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" title="New sub-category"
                disabled={!selectedCat} onClick={() => setSubDialog(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {ready && (
          <div className="flex items-center gap-2 text-xs text-success bg-success/10 border border-success/20 rounded-lg px-3 py-2">
            <span className="font-semibold">{selectedCatName}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-semibold">{selectedSubName}</span>
            <span className="ml-auto text-success">✓ Ready</span>
          </div>
        )}
      </div>

      {/* Step 2 — Tabs */}
      <div className="rounded-2xl border border-border bg-card/50 p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Step 2 — Add method
        </div>

        {!ready && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs text-warning mb-4">
            ⚠ Select a category and sub-category above before adding questions.
          </div>
        )}

        <Tabs defaultValue="manual">
          <TabsList className="mb-6 w-full grid grid-cols-4">
            <TabsTrigger value="manual" className="gap-1.5">
              <FileEdit className="h-3.5 w-3.5" /><span className="hidden sm:inline">Manual</span>
            </TabsTrigger>
            <TabsTrigger value="scan" className="gap-1.5">
              <ScanLine className="h-3.5 w-3.5" /><span className="hidden sm:inline">Scan</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /><span className="hidden sm:inline">AI Generate</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-1.5">
              <Upload className="h-3.5 w-3.5" /><span className="hidden sm:inline">Upload</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <ManualTab disabled={saving || !ready} onSave={(d) => saveDrafts(d, "manual")} />
          </TabsContent>
          <TabsContent value="scan">
            <Suspense fallback={<TabLoading />}>
              <ScanTab disabled={saving || !ready} saving={saving} onSave={(d) => saveDrafts(d, "ocr")} />
            </Suspense>
          </TabsContent>
          <TabsContent value="ai">
            <Suspense fallback={<TabLoading />}>
              <AiTab disabled={saving || !ready} saving={saving} onSave={(d) => saveDrafts(d, "ai")} />
            </Suspense>
          </TabsContent>
          <TabsContent value="upload">
            <Suspense fallback={<TabLoading />}>
              <UploadTab disabled={saving || !ready} saving={saving} onSave={(d) => saveDrafts(d, "import")} />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>

      <QuickCreateDialog open={catDialog} onClose={() => setCatDialog(false)}
        title="New category" placeholder="e.g. Science, History"
        onConfirm={createCat} />
      <QuickCreateDialog open={subDialog} onClose={() => setSubDialog(false)}
        title="New sub-category" placeholder="e.g. Physics, World War II"
        onConfirm={createSub} />
    </div>
  );
}

function TabLoading() {
  return <div className="rounded-xl border border-border bg-card/30 p-6 text-sm text-muted-foreground">Loading...</div>;
}
