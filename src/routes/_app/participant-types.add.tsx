import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Copy,
  FileText,
  Image as ImageIcon,
  Mail,
  Plus,
  Save,
  ScanLine,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { copyText } from "@/lib/copy-text";
import { ParticipantDraftReview } from "@/components/participants/ParticipantDraftReview";
import { parseParticipantsCsv } from "@/components/participants/parser";
import { extractParticipantsFromImage } from "@/components/participants/ai.server";
import {
  emptyDraft,
  validateDraft,
  draftToRow,
  type ParticipantDraft,
  type ParticipantType,
} from "@/components/participants/types";

export const Route = createFileRoute("/_app/participant-types/add")({ component: AddParticipantPage });

type TypeRow = { id: string; name: string };
type SubRow = { id: string; type_id: string; name: string };
type InviteRow = { email: string | null; token: string; url: string };

type SupportedMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const SUPPORTED_IMG: SupportedMediaType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMG = 5 * 1024 * 1024;
const MAX_CSV = 1024 * 1024;

const TYPE_OPTIONS: { value: ParticipantType; label: string; emoji: string }[] = [
  { value: "student", label: "Student", emoji: "🎓" },
  { value: "teacher", label: "Teacher", emoji: "📚" },
  { value: "employee", label: "Employee", emoji: "💼" },
  { value: "fun", label: "Fun / Guest", emoji: "🎉" },
];

/* ── Quick-create dialog ── */
function QuickCreateDialog({ open, onClose, title, placeholder, onConfirm }: {
  open: boolean; onClose: () => void; title: string; placeholder: string;
  onConfirm: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const name = value.trim();
    if (!name) { toast.error("Name is required"); return; }
    setBusy(true);
    try { await onConfirm(name); setValue(""); onClose(); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setValue(""); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div>
          <Label className="mb-1.5">Name</Label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} autoFocus onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setValue(""); onClose(); }} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-gradient-primary text-primary-foreground shadow-glow">{busy ? "Creating…" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Group selector (type + subtype) ── */
function GroupSelector({
  types, subs, typeId, subId, onTypeChange, onSubChange,
  onNewType, onNewSub,
}: {
  types: TypeRow[]; subs: SubRow[];
  typeId: string; subId: string;
  onTypeChange: (v: string) => void;
  onSubChange: (v: string) => void;
  onNewType: () => void;
  onNewSub: () => void;
}) {
  const visibleSubs = subs.filter((s) => s.type_id === typeId);
  return (
    <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step 1 — Choose group</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 text-sm">Type</Label>
          <div className="flex gap-1">
            <Select value={typeId || "__none__"} onValueChange={(v) => onTypeChange(v === "__none__" ? "" : v)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Select type —</SelectItem>
                {types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" title="New type" onClick={onNewType}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div>
          <Label className="mb-1.5 text-sm">Sub-type <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <div className="flex gap-1">
            <Select value={subId || "__none__"} onValueChange={(v) => onSubChange(v === "__none__" ? "" : v)} disabled={!typeId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={typeId ? "Select sub-type" : "Pick type first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {visibleSubs.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" title="New sub-type" disabled={!typeId} onClick={onNewSub}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main page ── */
function AddParticipantPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [types, setTypes] = useState<TypeRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [typeId, setTypeId] = useState("");
  const [subId, setSubId] = useState("");

  const [createTypeOpen, setCreateTypeOpen] = useState(false);
  const [createSubOpen, setCreateSubOpen] = useState(false);

  const loadGroups = useCallback(async () => {
    if (!user) return;
    const [tRes, sRes] = await Promise.all([
      supabase.from("participant_types").select("id, name").eq("owner_id", user.id).order("created_at"),
      supabase.from("participant_subtypes").select("id, type_id, name").eq("owner_id", user.id).order("created_at"),
    ]);
    if (tRes.data) setTypes(tRes.data);
    if (sRes.data) setSubs(sRes.data);
  }, [user]);

  useEffect(() => { void loadGroups(); }, [loadGroups]);

  const createType = async (name: string) => {
    if (!user) return;
    const { data, error } = await supabase.from("participant_types").insert({ owner_id: user.id, name }).select("id").single();
    if (error) { toast.error(error.message); throw error; }
    toast.success(`Type "${name}" created`);
    await loadGroups();
    if (data) setTypeId(data.id);
  };

  const createSub = async (name: string) => {
    if (!user || !typeId) return;
    const { data, error } = await supabase.from("participant_subtypes").insert({ owner_id: user.id, type_id: typeId, name }).select("id").single();
    if (error) { toast.error(error.message); throw error; }
    toast.success(`Sub-type "${name}" created`);
    await loadGroups();
    if (data) setSubId(data.id);
  };

  /* Shared insert helpers */
  const insertOne = async (draft: ParticipantDraft) => {
    if (!user) return;
    const row = draftToRow(draft, user.id);
    const { error } = await supabase.from("participants").insert({ ...row, subtype_id: subId || null });
    if (error) { toast.error(error.message); throw error; }
  };

  const insertMany = async (drafts: ParticipantDraft[]) => {
    if (!user || !drafts.length) return;
    const rows = drafts.map((d) => ({ ...draftToRow(d, user.id), subtype_id: subId || null }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("participants").insert(rows as any);
    if (error) { toast.error(error.message); throw error; }
    toast.success(`Added ${drafts.length} participant${drafts.length === 1 ? "" : "s"}`);
  };

  const generateInvite = async (): Promise<InviteRow | null> => {
    if (!user || !subId) { toast.error("Select a sub-type to generate invite links."); return null; }
    const { data, error } = await supabase.from("participant_invites")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert([{ owner_id: user.id, subtype_id: subId, email: null as any }])
      .select("id, email, token").single();
    if (error) { toast.error(error.message); return null; }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return { email: data.email, token: data.token, url: `${origin}/invite/${data.token}` };
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back + header */}
      <div>
        <button
          type="button"
          onClick={() => navigate({ to: "/participant-types" })}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to participants
        </button>
        <h1 className="font-display text-3xl font-bold tracking-tight">Add Participants</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose how you'd like to add participants — manually, by invite link, via file upload, or by scanning an image.
        </p>
      </div>

      {/* Group selector */}
      <GroupSelector
        types={types} subs={subs}
        typeId={typeId} subId={subId}
        onTypeChange={(v) => { setTypeId(v); setSubId(""); }}
        onSubChange={setSubId}
        onNewType={() => setCreateTypeOpen(true)}
        onNewSub={() => setCreateSubOpen(true)}
      />

      {/* Tabs */}
      <div className="rounded-2xl border border-border bg-card/50 p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Step 2 — Add method</div>
        <Tabs defaultValue="manual">
          <TabsList className="mb-6 w-full grid grid-cols-4">
            <TabsTrigger value="manual" className="gap-1.5"><UserPlus className="h-3.5 w-3.5" /><span className="hidden sm:inline">Manual</span></TabsTrigger>
            <TabsTrigger value="invite" className="gap-1.5"><Mail className="h-3.5 w-3.5" /><span className="hidden sm:inline">Invite Link</span></TabsTrigger>
            <TabsTrigger value="upload" className="gap-1.5"><Upload className="h-3.5 w-3.5" /><span className="hidden sm:inline">Upload CSV</span></TabsTrigger>
            <TabsTrigger value="scan" className="gap-1.5"><ScanLine className="h-3.5 w-3.5" /><span className="hidden sm:inline">Scan Image</span></TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <ManualTab typeId={typeId} onSave={async (d) => { await insertOne(d); toast.success(`Added ${d.name}`); }} />
          </TabsContent>

          <TabsContent value="invite">
            <InviteTab subId={subId} onGenerate={generateInvite} />
          </TabsContent>

          <TabsContent value="upload">
            <UploadTab typeId={typeId} onSave={insertMany} />
          </TabsContent>

          <TabsContent value="scan">
            <ScanTab typeId={typeId} onSave={insertMany} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Quick-create dialogs */}
      <QuickCreateDialog open={createTypeOpen} onClose={() => setCreateTypeOpen(false)} title="New participant type" placeholder="e.g. Student, Teacher, Employee" onConfirm={createType} />
      <QuickCreateDialog open={createSubOpen} onClose={() => setCreateSubOpen(false)} title="New sub-type" placeholder="e.g. Class 9, Engineering Team" onConfirm={createSub} />
    </div>
  );
}

/* ── Manual tab ── */
function ManualTab({ typeId, onSave }: { typeId: string; onSave: (d: ParticipantDraft) => Promise<void> }) {
  const [draft, setDraft] = useState<ParticipantDraft>(() => emptyDraft());
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof ParticipantDraft>(key: K, val: ParticipantDraft[K]) =>
    setDraft((p) => ({ ...p, [key]: val }));

  const submit = async () => {
    const v = validateDraft(draft);
    if (!v.ok) { toast.error(v.reason); return; }
    setBusy(true);
    try {
      await onSave(draft);
      setDraft(emptyDraft());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* toast shown by caller */ } finally { setBusy(false); }
  };

  if (!typeId) return (
    <div className="rounded-xl border border-dashed border-border bg-card/30 py-10 text-center">
      <UserPlus className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">Select a type above to add participants manually.</p>
    </div>
  );

  const ptype = draft.participant_type;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label className="mb-1.5">Participant type</Label>
          <Select value={ptype || "__none__"} onValueChange={(v) => set("participant_type", v === "__none__" ? "" : v as ParticipantType)}>
            <SelectTrigger><SelectValue placeholder="Select role (optional)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Not specified —</SelectItem>
              {TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.emoji} {o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2">
          <Label className="mb-1.5">Name <span className="text-destructive">*</span></Label>
          <Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" autoFocus />
        </div>
        <div>
          <Label className="mb-1.5">Email</Label>
          <Input type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} placeholder="participant@example.com" />
        </div>
        <div>
          <Label className="mb-1.5">Mobile</Label>
          <Input type="tel" value={draft.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="+92 300 0000000" />
        </div>

        {(ptype === "student" || ptype === "") && (
          <>
            <div>
              <Label className="mb-1.5">School / Organization</Label>
              <Input value={draft.organization} onChange={(e) => set("organization", e.target.value)} placeholder="Babul Academy" />
            </div>
            <div>
              <Label className="mb-1.5">Class / Grade</Label>
              <Input value={draft.grade || draft.class} onChange={(e) => { set("grade", e.target.value); set("class", e.target.value); }} placeholder="Class 10 / Year 12" />
            </div>
            <div>
              <Label className="mb-1.5">Roll number</Label>
              <Input value={draft.roll_number} onChange={(e) => set("roll_number", e.target.value)} placeholder="2026-CS-042" />
            </div>
            <div>
              <Label className="mb-1.5">Seat number</Label>
              <Input value={draft.seat_number} onChange={(e) => set("seat_number", e.target.value)} placeholder="A-12" />
            </div>
          </>
        )}

        {ptype === "teacher" && (
          <>
            <div>
              <Label className="mb-1.5">Employee ID</Label>
              <Input value={draft.employee_id} onChange={(e) => set("employee_id", e.target.value)} placeholder="EMP-1234" />
            </div>
            <div>
              <Label className="mb-1.5">School / Institution</Label>
              <Input value={draft.organization} onChange={(e) => set("organization", e.target.value)} placeholder="Babul Academy" />
            </div>
            <div>
              <Label className="mb-1.5">Subject / Class</Label>
              <Input value={draft.class} onChange={(e) => set("class", e.target.value)} placeholder="Mathematics, Class 9–10" />
            </div>
          </>
        )}

        {ptype === "employee" && (
          <>
            <div>
              <Label className="mb-1.5">Employee ID</Label>
              <Input value={draft.employee_id} onChange={(e) => set("employee_id", e.target.value)} placeholder="EMP-1234" />
            </div>
            <div>
              <Label className="mb-1.5">Company / Organization</Label>
              <Input value={draft.organization} onChange={(e) => set("organization", e.target.value)} placeholder="Acme Corp" />
            </div>
            <div>
              <Label className="mb-1.5">Department</Label>
              <Input value={draft.department} onChange={(e) => set("department", e.target.value)} placeholder="Engineering" />
            </div>
          </>
        )}

        {ptype === "fun" && (
          <div>
            <Label className="mb-1.5">Nickname / Alias</Label>
            <Input value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="QuizMaster99" />
          </div>
        )}

        {ptype !== "fun" && (
          <div className="md:col-span-2">
            <Label className="mb-1.5">Notes</Label>
            <Textarea value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Anything worth noting" rows={2} />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setDraft(emptyDraft())} disabled={busy}>Reset</Button>
        <Button onClick={submit} disabled={busy} className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
          {saved ? <><Check className="h-4 w-4" /> Added!</> : busy ? "Saving…" : <><UserPlus className="h-4 w-4" /> Add Participant</>}
        </Button>
      </div>
    </div>
  );
}

/* ── Invite link tab ── */
function InviteTab({ subId, onGenerate }: { subId: string; onGenerate: () => Promise<InviteRow | null> }) {
  const [invite, setInvite] = useState<InviteRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const row = await onGenerate();
      if (row) setInvite(row);
    } finally { setBusy(false); }
  };

  const copy = async (url: string) => {
    const ok = await copyText(url);
    if (ok) { setCopied(true); toast.success("Link copied"); setTimeout(() => setCopied(false), 1500); }
    else toast.error("Could not copy");
  };

  if (!subId) return (
    <div className="rounded-xl border border-dashed border-border bg-card/30 py-10 text-center">
      <Mail className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">Select a <span className="font-medium text-foreground">sub-type</span> above to generate invite links.</p>
      <p className="text-xs text-muted-foreground mt-1">Invite links are tied to a specific sub-type (e.g. Class 9).</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Generate a QR code + link that participants can open on their phones to self-register into the selected sub-type.
      </p>

      {!invite ? (
        <div className="flex justify-center">
          <Button onClick={generate} disabled={busy} className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow px-8">
            {busy ? "Generating…" : <><Mail className="h-4 w-4" /> Generate Invite Link</>}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5">
          <div className="rounded-2xl border-2 border-border bg-white p-4 shadow-card">
            <QRCodeSVG value={invite.url} size={200} />
          </div>

          <div className="w-full max-w-md rounded-xl border border-border bg-card/40 p-3 flex items-center gap-2">
            <input
              readOnly
              value={invite.url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 bg-muted/30 rounded-md px-3 py-2 font-mono text-xs outline-none"
            />
            <Button size="sm" variant="ghost" onClick={() => copy(invite.url)}>
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex gap-2 w-full max-w-md">
            <Button onClick={() => copy(invite.url)} className="flex-1 gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
              {copied ? <><Check className="h-4 w-4" /> Copied!</> : <><Copy className="h-4 w-4" /> Copy Link</>}
            </Button>
            <Button variant="outline" onClick={() => { setInvite(null); setCopied(false); }}>
              New Link
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Each link is single-use. Generate a new one for each participant, or share the QR code for anyone to scan.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Upload CSV tab ── */
function UploadTab({ typeId, onSave }: { typeId: string; onSave: (drafts: ParticipantDraft[]) => Promise<void> }) {
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("");
  const [drafts, setDrafts] = useState<ParticipantDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_CSV) { toast.error("File too large (max 1 MB)"); return; }
    const isText = file.type.startsWith("text/") || /\.(csv|tsv|txt)$/i.test(file.name);
    if (!isText) { toast.error("Only CSV, TSV, or plain-text files are accepted"); return; }
    setText(await file.text());
    setFilename(file.name);
    toast.success(`Loaded ${file.name}`);
  };

  const parse = () => {
    const out = parseParticipantsCsv(text);
    if (!out.length) { toast.error("No rows with a name found — check your header row"); return; }
    setDrafts(out);
    toast.success(`${out.length} participant${out.length === 1 ? "" : "s"} parsed`);
  };

  const handleSave = async () => {
    if (!drafts.length) return;
    const bad = drafts.findIndex((d) => !d.name.trim());
    if (bad >= 0) { toast.error(`Row ${bad + 1} is missing a name`); return; }
    setSaving(true);
    try { await onSave(drafts); setDrafts([]); setText(""); setFilename(""); }
    finally { setSaving(false); }
  };

  if (!typeId) return (
    <div className="rounded-xl border border-dashed border-border bg-card/30 py-10 text-center">
      <Upload className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">Select a type above before uploading a file.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload a CSV or Excel-exported CSV. Recognised columns: <span className="font-mono text-foreground text-xs">name</span>, <span className="font-mono text-foreground text-xs">email</span>, <span className="font-mono text-foreground text-xs">mobile</span>, <span className="font-mono text-foreground text-xs">roll_number</span>, <span className="font-mono text-foreground text-xs">class</span>, <span className="font-mono text-foreground text-xs">organization</span>. Only <span className="font-mono text-foreground text-xs">name</span> is required.
      </p>

      <div
        className="rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-card/30 p-8 text-center cursor-pointer transition-colors"
        onClick={() => fileRef.current?.click()}
        role="button"
      >
        <FileText className="mx-auto h-10 w-10 text-muted-foreground/60" />
        <div className="mt-3 text-sm font-medium">{filename ? `Loaded: ${filename}` : "Click to choose a CSV / TSV file"}</div>
        <div className="mt-1 text-xs text-muted-foreground">or drag-and-drop · up to 1 MB</div>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
      </div>

      <div>
        <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">Paste or edit content</Label>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={"name,email,roll_number,class\nAli Khan,ali@example.com,2026-CS-01,Class 9"} className="min-h-[140px] font-mono text-xs" />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => fileRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> Choose file</Button>
        <Button onClick={parse} className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">Parse rows</Button>
      </div>

      <ParticipantDraftReview drafts={drafts} setDrafts={setDrafts} />

      {drafts.length > 0 && (
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" onClick={() => setDrafts([])} disabled={saving}><X className="h-4 w-4 mr-1" /> Discard</Button>
          <Button onClick={handleSave} disabled={saving || !drafts.length} className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
            <Save className="h-4 w-4" />{saving ? "Saving…" : `Save all (${drafts.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ── Scan image tab ── */
function ScanTab({ typeId, onSave }: { typeId: string; onSave: (drafts: ParticipantDraft[]) => Promise<void> }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [imageBase64, setImageBase64] = useState("");
  const [mediaType, setMediaType] = useState<SupportedMediaType | null>(null);
  const [hint, setHint] = useState("");
  const [drafts, setDrafts] = useState<ParticipantDraft[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null); setImageName(""); setImageBase64(""); setMediaType(null);
    setHint(""); setDrafts([]);
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!SUPPORTED_IMG.includes(file.type as SupportedMediaType)) { toast.error("JPG, PNG, GIF, or WebP only"); return; }
    if (file.size > MAX_IMG) { toast.error("Image too large (max 5 MB)"); return; }
    const url = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImageBase64(result.split(",")[1] ?? "");
    };
    reader.readAsDataURL(file);
    setImageUrl(url);
    setImageName(file.name);
    setMediaType(file.type as SupportedMediaType);
    setDrafts([]);
  };

  const extract = async () => {
    if (!imageBase64 || !mediaType) { toast.error("Load an image first"); return; }
    setExtracting(true);
    try {
      const out = await extractParticipantsFromImage({ data: { imageBase64, mediaType, hint: hint || undefined } });
      if (!out.length) { toast.error("No participants found in the image"); return; }
      setDrafts(out);
      toast.success(`${out.length} participant${out.length === 1 ? "" : "s"} extracted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Extraction failed");
    } finally { setExtracting(false); }
  };

  const handleSave = async () => {
    if (!drafts.length) return;
    setSaving(true);
    try { await onSave(drafts); reset(); }
    finally { setSaving(false); }
  };

  if (!typeId) return (
    <div className="rounded-xl border border-dashed border-border bg-card/30 py-10 text-center">
      <ScanLine className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">Select a type above before scanning an image.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Upload a photo of a class list, attendance sheet, or any document — AI will extract participants automatically.</p>

      <div
        className="rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-card/30 p-6 text-center cursor-pointer transition-colors"
        onClick={() => fileRef.current?.click()}
        role="button"
      >
        {imageUrl ? (
          <img src={imageUrl} alt={imageName} className="mx-auto max-h-48 rounded-xl object-contain" />
        ) : (
          <>
            <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <div className="mt-3 text-sm font-medium">Click to choose an image</div>
            <div className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP — up to 5 MB</div>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
      </div>

      {imageUrl && (
        <div>
          <Label className="mb-1.5 text-sm">Hint for AI <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input value={hint} onChange={(e) => setHint(e.target.value)} placeholder='e.g. "Class 10-A attendance sheet, columns: name, roll no, class"' />
        </div>
      )}

      <div className="flex justify-end gap-2">
        {imageUrl && <Button variant="ghost" onClick={reset} disabled={extracting || saving}><X className="h-4 w-4 mr-1" /> Clear</Button>}
        <Button onClick={extract} disabled={!imageUrl || extracting} className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
          <ScanLine className="h-4 w-4" />{extracting ? "Extracting…" : "Extract participants"}
        </Button>
      </div>

      <ParticipantDraftReview drafts={drafts} setDrafts={setDrafts} />

      {drafts.length > 0 && (
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" onClick={() => setDrafts([])} disabled={saving}><X className="h-4 w-4 mr-1" /> Discard</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
            <Save className="h-4 w-4" />{saving ? "Saving…" : `Save all (${drafts.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}
