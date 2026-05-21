import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { validationError } from "@/components/ui/validation-toast";
import {
  ArrowLeft,
  Check,
  CheckCircle,
  Copy,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mail,
  Plus,
  Save,
  ScanLine,
  Upload,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { DynamicParticipantFields } from "@/components/participants/DynamicParticipantFields";
import {
  emptyDraft,
  validateDraft,
  draftToRow,
  type ParticipantDraft,
  type ParticipantType,
} from "@/components/participants/types";
import {
  defaultHostSettings,
  normalizeRegistrationFields,
  normalizeRegistrationFieldsByType,
  resolveRegistrationFields,
  type HostSettings,
} from "@/components/settings/host-settings";

export const Route = createFileRoute("/_app/participant-types/add")({ component: AddParticipantPage });

type TypeRow = { id: string; name: string };
type SubRow = { id: string; type_id: string; name: string };
type InviteRow = { email: string | null; token: string; url: string; participant_type?: string };

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
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const name = value.trim();
    if (!name) { toast.error(t("ptAdd.nameRequired")); return; }
    setBusy(true);
    try { await onConfirm(name); setValue(""); onClose(); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setValue(""); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div>
          <Label className="mb-1.5">{t("ptAdd.name")}</Label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} autoFocus onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setValue(""); onClose(); }} disabled={busy}>{t("common.cancel")}</Button>
          <Button onClick={submit} disabled={busy} className="bg-gradient-primary text-primary-foreground shadow-glow">{busy ? t("common.saving") : t("common.create")}</Button>
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
  const { t } = useI18n();
  const visibleSubs = subs.filter((s) => s.type_id === typeId);
  const selectedType = types.find((t) => t.id === typeId);
  const selectedSub = visibleSubs.find((s) => s.id === subId);

  return (
    <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
      {/* Step label + destination pill */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">1</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("ptAdd.step1")}</span>
        </div>
        {selectedType && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <Check className="h-3 w-3" /> {selectedType.name}{selectedSub ? ` → ${selectedSub.name}` : ""}
          </span>
        )}
      </div>

      {/* Type chips */}
      <div>
        <Label className="mb-2 text-xs text-muted-foreground font-medium">{t("ptAdd.typeLabel")}</Label>
        <div className="flex flex-wrap gap-2">
          {types.map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => onTypeChange(type.id === typeId ? "" : type.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                typeId === type.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {type.name}
            </button>
          ))}
          <button
            type="button"
            onClick={onNewType}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors min-h-[32px]"
          >
            <Plus className="h-3 w-3" /> {t("ptAdd.newType")}
          </button>
        </div>
      </div>

      {/* Group chips — only show after type selected */}
      {typeId && (
        <div>
          <Label className="mb-2 text-xs text-muted-foreground font-medium">
            {t("ptAdd.groupLabel")} <span className="font-normal">({t("ptAdd.groupOptional")})</span>
          </Label>
          <div className="flex flex-wrap gap-2">
            {visibleSubs.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSubChange(sub.id === subId ? "" : sub.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                  subId === sub.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {sub.name}
              </button>
            ))}
            <button
              type="button"
              onClick={onNewSub}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors min-h-[32px]"
            >
              <Plus className="h-3 w-3" /> {t("ptAdd.newGroup")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main page ── */
function AddParticipantPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [types, setTypes] = useState<TypeRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [typeId, setTypeId] = useState("");
  const [subId, setSubId] = useState("");
  const [hostSettings, setHostSettings] = useState<HostSettings>(() => defaultHostSettings());

  const [createTypeOpen, setCreateTypeOpen] = useState(false);
  const [createSubOpen, setCreateSubOpen] = useState(false);

  const loadGroups = useCallback(async () => {
    if (!user) return;
    const [tRes, sRes, hsRes] = await Promise.all([
      supabase.from("participant_types").select("id, name").eq("owner_id", user.id).order("created_at"),
      supabase.from("participant_subtypes").select("id, type_id, name").eq("owner_id", user.id).order("created_at"),
      supabase.from("host_settings").select("registration_fields, registration_fields_by_type").eq("owner_id", user.id).maybeSingle(),
    ]);
    if (tRes.data) setTypes(tRes.data);
    if (sRes.data) setSubs(sRes.data);
    if (hsRes.data) {
      setHostSettings({
        ...defaultHostSettings(),
        registration_fields: normalizeRegistrationFields(hsRes.data.registration_fields),
        registration_fields_by_type: normalizeRegistrationFieldsByType(
          (hsRes.data as Record<string, unknown>).registration_fields_by_type,
        ),
      });
    }
  }, [user]);

  useEffect(() => { void loadGroups(); }, [loadGroups]);

  const createType = async (name: string) => {
    if (!user) return;
    const { data, error } = await supabase.from("participant_types").insert({ owner_id: user.id, name }).select("id").single();
    if (error) { toast.error(error.message); throw error; }
    toast.success(t("pt.typeCreated").replace("{name}", name));
    await loadGroups();
    if (data) setTypeId(data.id);
  };

  const createSub = async (name: string) => {
    if (!user || !typeId) return;
    const { data, error } = await supabase.from("participant_subtypes").insert({ owner_id: user.id, type_id: typeId, name }).select("id").single();
    if (error) { toast.error(error.message); throw error; }
    toast.success(t("pt.groupCreated").replace("{name}", name));
    await loadGroups();
    if (data) setSubId(data.id);
  };

  /* Shared insert helpers */
  const insertOne = async (draft: ParticipantDraft) => {
    if (!user) return;
    // Check for duplicate email within this owner's participants
    if (draft.email?.trim()) {
      const { data: existing } = await supabase
        .from("participants")
        .select("id, name")
        .eq("owner_id", user.id)
        .ilike("email", draft.email.trim())
        .maybeSingle();
      if (existing) {
        const err = new Error(`A participant with this email already exists: "${existing.name}"`);
        toast.error(err.message);
        throw err;
      }
    }
    const row = draftToRow(draft, user.id);
    const { error } = await supabase.from("participants").insert({ ...row, subtype_id: subId || null });
    if (error) { toast.error(error.message); throw error; }
  };

  const insertMany = async (drafts: ParticipantDraft[]) => {
    if (!user || !drafts.length) return;
    // Check for duplicate emails in bulk
    const emails = drafts.map(d => d.email?.trim().toLowerCase()).filter(Boolean) as string[];
    if (emails.length > 0) {
      const { data: dupes } = await supabase
        .from("participants")
        .select("name, email")
        .eq("owner_id", user.id)
        .in("email", emails);
      if (dupes && dupes.length > 0) {
        const list = dupes.map((d: { name: string; email: string }) => d.email).join(", ");
        toast.error(`${dupes.length} duplicate email(s) found: ${list}. Remove them and try again.`);
        throw new Error("Duplicate emails");
      }
    }
    const rows = drafts.map((d) => ({ ...draftToRow(d, user.id), subtype_id: subId || null }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("participants").insert(rows as any);
    if (error) { toast.error(error.message); throw error; }
    toast.success(`${t("pt.added")} ${drafts.length} ${drafts.length === 1 ? t("pt.participant") : t("pt.participants")}`);
  };

  const generateInvite = async (participantType?: string): Promise<InviteRow | null> => {
    if (!user || !subId) { toast.error(t("pt.selectGroupFirst")); return null; }
    const { data, error } = await supabase.from("participant_invites")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert([{ owner_id: user.id, subtype_id: subId, email: null as any, participant_type: participantType || null }])
      .select("id, email, token").single();
    if (error) { toast.error(error.message); return null; }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return { email: data.email, token: data.token, url: `${origin}/invite/${data.token}`, participant_type: participantType };
  };

  const [method, setMethod] = useState<"manual" | "invite" | "upload" | "scan" | "existing">("manual");

  const METHODS: { value: "manual" | "invite" | "upload" | "scan" | "existing"; icon: React.ReactNode; label: string; desc: string }[] = [
    { value: "manual", icon: <UserPlus className="h-5 w-5" />, label: t("ptAdd.tabManual"), desc: "Fill in details one at a time" },
    { value: "existing", icon: <Plus className="h-5 w-5" />, label: "From Existing", desc: "Re-add from another group" },
    { value: "invite", icon: <Mail className="h-5 w-5" />, label: t("ptAdd.tabInvite"), desc: "Send a self-join link or QR" },
    { value: "upload", icon: <Upload className="h-5 w-5" />, label: t("ptAdd.tabUpload"), desc: "Bulk import from CSV file" },
    { value: "scan", icon: <ScanLine className="h-5 w-5" />, label: t("ptAdd.tabScan"), desc: "Extract from a photo or scan" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Back + hero header */}
      <div>
        <button
          type="button"
          onClick={() => navigate({ to: "/participant-types" })}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("ptAdd.backTo")}
        </button>
        <div className="rounded-2xl border border-border bg-card/60 p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow shrink-0">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">{t("ptAdd.title")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("ptAdd.desc")}</p>
          </div>
        </div>
      </div>

      {/* Step 1 — Group selector */}
      <GroupSelector
        types={types} subs={subs}
        typeId={typeId} subId={subId}
        onTypeChange={(v) => { setTypeId(v); setSubId(""); }}
        onSubChange={setSubId}
        onNewType={() => setCreateTypeOpen(true)}
        onNewSub={() => setCreateSubOpen(true)}
      />

      {/* Step 2 — Method cards */}
      <div className={`rounded-2xl border border-border bg-card/50 p-5 space-y-4 transition-opacity ${!typeId ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">2</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("ptAdd.step2")}</span>
        </div>

        {/* Method cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMethod(m.value)}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all min-h-[88px] ${
                method === m.value
                  ? "border-primary bg-primary/10 text-primary shadow-glow"
                  : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {m.icon}
              <span className="text-xs font-semibold leading-tight">{m.label}</span>
              <span className="text-[10px] leading-tight opacity-70 hidden sm:block">{m.desc}</span>
            </button>
          ))}
        </div>

        {/* Active method content */}
        <div className="pt-2 border-t border-border">
          {method === "manual" && (
            <ManualTab typeId={typeId} hostSettings={hostSettings} ownerId={user?.id ?? ""} onSave={async (d) => { await insertOne(d); toast.success(t("pt.participantAdded").replace("{name}", d.name)); }} />
          )}
          {method === "invite" && (
            <InviteTab subId={subId} onGenerate={(pt) => generateInvite(pt)} />
          )}
          {method === "upload" && (
            <UploadTab typeId={typeId} onSave={insertMany} />
          )}
          {method === "scan" && (
            <ScanTab typeId={typeId} onSave={insertMany} />
          )}
          {method === "existing" && (
            <ExistingTab ownerId={user?.id ?? ""} subId={subId} />
          )}
        </div>
      </div>

      {/* Quick-create dialogs */}
      <QuickCreateDialog open={createTypeOpen} onClose={() => setCreateTypeOpen(false)} title={t("ptAdd.newTypeTitle")} placeholder={t("ptAdd.newTypePlaceholder")} onConfirm={createType} />
      <QuickCreateDialog open={createSubOpen} onClose={() => setCreateSubOpen(false)} title={t("ptAdd.newGroupTitle")} placeholder={t("ptAdd.newGroupPlaceholder")} onConfirm={createSub} />
    </div>
  );
}

/* ── Manual tab ── */
function ManualTab({ typeId, hostSettings, ownerId, onSave }: {
  typeId: string;
  hostSettings: HostSettings;
  ownerId: string;
  onSave: (d: ParticipantDraft) => Promise<void>;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<ParticipantDraft>(() => emptyDraft());
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [emailCheck, setEmailCheck] = useState<"idle" | "checking" | "taken" | "available">("idle");
  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (patch: Partial<ParticipantDraft>) => {
    setDraft((p) => ({ ...p, ...patch }));
    if ("email" in patch) {
      const email = patch.email?.trim() ?? "";
      if (emailTimer.current) clearTimeout(emailTimer.current);
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setEmailCheck("idle");
        return;
      }
      setEmailCheck("checking");
      emailTimer.current = setTimeout(async () => {
        const { data: existing } = await supabase
          .from("participants")
          .select("id")
          .eq("owner_id", ownerId)
          .ilike("email", email)
          .maybeSingle();
        setEmailCheck(existing ? "taken" : "available");
      }, 600);
    }
  };

  const ptype = draft.participant_type;
  const fieldConfig = resolveRegistrationFields(hostSettings, ptype);

  const submit = async () => {
    const v = validateDraft(draft, fieldConfig);
    if (!v.ok) { toast.error(v.reason); return; }
    if (emailCheck === "taken") { toast.error("A participant with this email already exists."); return; }
    setBusy(true);
    try {
      await onSave(draft);
      setDraft(emptyDraft());
      setEmailCheck("idle");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* toast shown by caller */ } finally { setBusy(false); }
  };

  if (!typeId) return (
    <div className="rounded-xl border border-dashed border-border bg-card/30 py-10 text-center">
      <UserPlus className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">{t("ptAdd.selectTypeManual")}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Participant type chips — host selects before adding */}
      <div>
        <Label className="mb-2 text-xs text-muted-foreground font-medium">{t("ptAdd.participantType")}</Label>
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => set({ participant_type: ptype === o.value ? "" : o.value as ParticipantType })}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                ptype === o.value
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {o.emoji} {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Name — always required */}
      <div>
        <Label className="mb-1.5">{t("ptAdd.name")} <span className="text-destructive">*</span></Label>
        <Input
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder={t("ptAdd.fullName")}
          autoFocus
        />
      </div>

      {/* Dynamic fields based on host's per-type config */}
      <DynamicParticipantFields draft={draft} fields={fieldConfig} onSet={set} />

      {/* Email duplicate feedback */}
      {draft.email && emailCheck !== "idle" && (
        <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
          emailCheck === "checking" ? "bg-muted/30 text-muted-foreground" :
          emailCheck === "taken"    ? "bg-destructive/10 text-destructive border border-destructive/30" :
          "bg-success/10 text-success border border-success/30"
        }`}>
          {emailCheck === "checking"  && <Loader2 size={13} className="animate-spin shrink-0" />}
          {emailCheck === "taken"     && <XCircle size={13} className="shrink-0" />}
          {emailCheck === "available" && <CheckCircle size={13} className="shrink-0" />}
          {emailCheck === "checking"  && "Checking email…"}
          {emailCheck === "taken"     && "A participant with this email already exists."}
          {emailCheck === "available" && "Email is available ✓"}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => { setDraft(emptyDraft()); setEmailCheck("idle"); }} disabled={busy}>{t("ptAdd.reset")}</Button>
        <Button onClick={submit} disabled={busy || emailCheck === "checking" || emailCheck === "taken"} className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
          {saved ? <><Check className="h-4 w-4" /> {t("ptAdd.added")}</> : busy ? t("ptAdd.saving") : <><UserPlus className="h-4 w-4" /> {t("ptAdd.addParticipant")}</>}
        </Button>
      </div>
    </div>
  );
}

/* ── From Existing tab ── */
type ExistingParticipant = { id: string; name: string; email: string | null; mobile: string | null; participant_type: string | null; metadata: Record<string, unknown> };

function ExistingTab({ ownerId, subId }: { ownerId: string; subId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExistingParticipant[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (q: string) => {
    setQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from("participants")
        .select("id, name, email, mobile, metadata")
        .eq("owner_id", ownerId)
        .or(`name.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%`)
        .order("name")
        .limit(20);
      setResults((data ?? []).map((r) => ({ ...r, participant_type: null })) as ExistingParticipant[]);
    }, 400);
  };

  const addToGroup = async (p: ExistingParticipant) => {
    if (!subId) { toast.error("Please select a group first."); return; }
    setAdding(p.id);
    // check duplicate in target subtype
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: exists } = await (supabase.rpc as any)("check_participant_email_in_subtype", {
      p_subtype_id: subId,
      p_email: p.email ?? "",
    });
    if (exists && p.email) {
      toast.error("This participant's email is already in the target group.");
      setAdding(null);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase.from("participants").insert({
      owner_id: ownerId,
      subtype_id: subId,
      name: p.name,
      email: p.email,
      mobile: p.mobile,
      metadata: p.metadata ?? {},
    } as any);
    if (error) { toast.error(error.message); }
    else {
      setAdded((prev) => new Set(prev).add(p.id));
      toast.success(`${p.name} added to group.`);
    }
    setAdding(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Search participants you've already added elsewhere and add them to this group in one click.</p>
      <Input
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder="Search by name or email…"
        autoFocus
      />
      {results.length === 0 && query.trim() && (
        <p className="text-center text-sm text-muted-foreground py-6">No participants found for "{query}"</p>
      )}
      {results.length > 0 && (
        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
          {results.map((p) => {
            const isAdded = added.has(p.id);
            const isBusy = adding === p.id;
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-card/50">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  {p.email && <p className="text-xs text-muted-foreground truncate">{p.email}</p>}
                </div>
                <Button
                  size="sm"
                  variant={isAdded ? "ghost" : "default"}
                  disabled={isBusy || isAdded || !subId}
                  onClick={() => addToGroup(p)}
                  className={`shrink-0 gap-1.5 ${isAdded ? "text-success" : "bg-gradient-primary text-primary-foreground shadow-glow"}`}
                >
                  {isBusy ? <Loader2 size={14} className="animate-spin" /> : isAdded ? <Check size={14} /> : <Plus size={14} />}
                  {isBusy ? "Adding…" : isAdded ? "Added" : "Add"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
      {!subId && query.trim() && (
        <p className="text-xs text-amber-400 text-center">Select a group above before adding participants.</p>
      )}
    </div>
  );
}

/* ── Invite link tab ── */
function InviteTab({ subId, onGenerate }: { subId: string; onGenerate: (participantType?: string) => Promise<InviteRow | null> }) {
  const { t } = useI18n();
  const [invite, setInvite] = useState<InviteRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");

  const generate = async () => {
    setBusy(true);
    try {
      const row = await onGenerate(selectedType || undefined);
      if (row) setInvite(row);
    } finally { setBusy(false); }
  };

  const copy = async (url: string) => {
    const ok = await copyText(url);
    if (ok) { setCopied(true); toast.success(t("ptAdd.linkCopied")); setTimeout(() => setCopied(false), 1500); }
    else toast.error("Could not copy");
  };

  if (!subId) return (
    <div className="rounded-xl border border-dashed border-border bg-card/30 py-10 text-center">
      <Mail className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">{t("ptAdd.selectGroupInvite")}</p>
      <p className="text-xs text-muted-foreground mt-1">{t("ptAdd.inviteGroupNote")}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("ptAdd.inviteDesc")}</p>

      {!invite ? (
        <div className="space-y-4">
          {/* Host selects participant type before generating invite */}
          <div>
            <Label className="mb-2 text-xs text-muted-foreground font-medium">Participant type for this invite</Label>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setSelectedType(selectedType === o.value ? "" : o.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                    selectedType === o.value
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {o.emoji} {o.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Participant will see fields for the selected type. They cannot change this.
            </p>
          </div>

          <div className="flex justify-center">
            <Button onClick={generate} disabled={busy} className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow px-8">
              {busy ? t("ptAdd.generating") : <><Mail className="h-4 w-4" /> {t("ptAdd.generateInvite")}</>}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5">
          <div className="rounded-2xl border-2 border-border bg-white p-4 shadow-card">
            <QRCodeSVG value={invite.url} size={200} />
          </div>

          <div className="w-full max-w-md rounded-xl border border-border bg-card/40 p-3 flex items-center gap-2">
            <input
              readOnly
              aria-label="Invite link"
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
              {copied ? <><Check className="h-4 w-4" /> {t("ptAdd.copied")}</> : <><Copy className="h-4 w-4" /> {t("ptAdd.copyLink")}</>}
            </Button>
            <Button variant="outline" onClick={() => { setInvite(null); setCopied(false); }}>
              {t("ptAdd.newLink")}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">{t("ptAdd.inviteSingleUse")}</p>
        </div>
      )}
    </div>
  );
}

/* ── Upload CSV tab ── */
function UploadTab({ typeId, onSave }: { typeId: string; onSave: (drafts: ParticipantDraft[]) => Promise<void> }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [filename, setFilename] = useState("");
  const [drafts, setDrafts] = useState<ParticipantDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_CSV) { validationError("File too large (max 1 MB)"); return; }
    const isText = file.type.startsWith("text/") || /\.(csv|tsv|txt)$/i.test(file.name);
    if (!isText) { validationError("Only CSV, TSV, or plain-text files are accepted"); return; }
    setText(await file.text());
    setFilename(file.name);
    toast.success(`Loaded ${file.name}`);
  };

  const parse = () => {
    const out = parseParticipantsCsv(text);
    if (!out.length) { toast.error("No rows with a name found - check your header row"); return; }
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
      <p className="text-sm text-muted-foreground">{t("ptAdd.selectTypeUpload")}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload a CSV or Excel-exported CSV. Recognised columns: <span className="font-mono text-foreground text-xs">name</span>, <span className="font-mono text-foreground text-xs">email</span>, <span className="font-mono text-foreground text-xs">mobile</span>, <span className="font-mono text-foreground text-xs">roll_number</span>, <span className="font-mono text-foreground text-xs">class</span>, <span className="font-mono text-foreground text-xs">organization</span>. Only <span className="font-mono text-foreground text-xs">name</span> is required.
      </p>

      <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="hidden" aria-label="Upload CSV file" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
      <div
        className="rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-card/30 p-8 text-center cursor-pointer transition-colors"
        onClick={() => fileRef.current?.click()}
        role="button"
        aria-label={filename ? `Loaded: ${filename}` : t("ptAdd.chooseFile")}
      >
        <FileText className="mx-auto h-10 w-10 text-muted-foreground/60" />
        <div className="mt-3 text-sm font-medium">{filename ? `Loaded: ${filename}` : t("ptAdd.chooseFile")}</div>
        <div className="mt-1 text-xs text-muted-foreground">{t("ptAdd.dragDrop")}</div>
      </div>

      <div>
        <Label className="mb-1.5 text-xs uppercase tracking-wider text-muted-foreground">{t("ptAdd.pasteEdit")}</Label>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={"name,email,roll_number,class\nAli Khan,ali@example.com,2026-CS-01,Class 9"} className="min-h-[140px] font-mono text-xs" />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => fileRef.current?.click()} className="gap-2"><Upload className="h-4 w-4" /> {t("ptAdd.chooseFileBtn")}</Button>
        <Button onClick={parse} className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">{t("ptAdd.parseRows")}</Button>
      </div>

      <ParticipantDraftReview drafts={drafts} setDrafts={setDrafts} />

      {drafts.length > 0 && (
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" onClick={() => setDrafts([])} disabled={saving}><X className="h-4 w-4 mr-1" /> {t("ptAdd.discard")}</Button>
          <Button onClick={handleSave} disabled={saving || !drafts.length} className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
            <Save className="h-4 w-4" />{saving ? t("ptAdd.saving") : `${t("ptAdd.saveAll")} (${drafts.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ── Scan image tab ── */
function ScanTab({ typeId, onSave }: { typeId: string; onSave: (drafts: ParticipantDraft[]) => Promise<void> }) {
  const { t } = useI18n();
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
    if (!SUPPORTED_IMG.includes(file.type as SupportedMediaType)) { validationError("JPG, PNG, GIF, or WebP only"); return; }
    if (file.size > MAX_IMG) { validationError("Image too large (max 5 MB)"); return; }
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
      const { extractParticipantsFromImage } = await import("@/components/participants/ai.server");
      const out = await extractParticipantsFromImage({
        data: { imageBase64, mediaType, hint: hint || undefined },
      });
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
      <p className="text-sm text-muted-foreground">{t("ptAdd.selectTypeScan")}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("ptAdd.scanDesc")}</p>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" aria-label="Upload image for scanning" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
      <div
        className="rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-card/30 p-6 text-center cursor-pointer transition-colors"
        onClick={() => fileRef.current?.click()}
        role="button"
        aria-label={imageUrl ? imageName : t("ptAdd.clickImage")}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={imageName} className="mx-auto max-h-48 rounded-xl object-contain" />
        ) : (
          <>
            <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <div className="mt-3 text-sm font-medium">{t("ptAdd.clickImage")}</div>
            <div className="mt-1 text-xs text-muted-foreground">{t("ptAdd.imgFormats")}</div>
          </>
        )}
      </div>

      {imageUrl && (
        <div>
          <Label className="mb-1.5 text-sm">{t("ptAdd.hintForAi")} <span className="text-muted-foreground font-normal">({t("ptAdd.groupOptional")})</span></Label>
          <Input value={hint} onChange={(e) => setHint(e.target.value)} placeholder='e.g. "Class 10-A attendance sheet, columns: name, roll no, class"' />
        </div>
      )}

      <div className="flex justify-end gap-2">
        {imageUrl && <Button variant="ghost" onClick={reset} disabled={extracting || saving}><X className="h-4 w-4 mr-1" /> {t("ptAdd.clear")}</Button>}
        <Button onClick={extract} disabled={!imageUrl || extracting} className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
          <ScanLine className="h-4 w-4" />{extracting ? t("ptAdd.extracting") : t("ptAdd.extractParticipants")}
        </Button>
      </div>

      <ParticipantDraftReview drafts={drafts} setDrafts={setDrafts} />

      {drafts.length > 0 && (
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" onClick={() => setDrafts([])} disabled={saving}><X className="h-4 w-4 mr-1" /> {t("ptAdd.discard")}</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
            <Save className="h-4 w-4" />{saving ? t("ptAdd.saving") : `${t("ptAdd.saveAll")} (${drafts.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}
