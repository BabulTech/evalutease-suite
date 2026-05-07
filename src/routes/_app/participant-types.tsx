import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Armchair,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Hash,
  Mail,
  Pencil,
  Phone,
  Plus,
  ScanLine,
  Search,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  Upload,
  UserPlus,
  Users,
  UsersRound,
  X,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ParticipantDialog } from "@/components/participants/ParticipantDialog";
import { InviteDialog, type InviteRow } from "@/components/participants/InviteDialog";
import { UploadParticipantsDialog } from "@/components/participants/UploadParticipantsDialog";
import { ScanParticipantsDialog } from "@/components/participants/ScanParticipantsDialog";
import {
  draftFromParticipant,
  draftToRow,
  type Participant,
  type ParticipantDraft,
  type ParticipantMeta,
} from "@/components/participants/types";

export const Route = createFileRoute("/_app/participant-types")({ component: ParticipantsPage });

/* ── DB row shapes ── */
type TypeRow = { id: string; name: string; icon: string | null };
type SubRow = { id: string; type_id: string; name: string; description: string | null };
type ParticipantRow = {
  id: string; name: string; email: string | null; mobile: string | null;
  metadata: unknown; subtype_id: string | null; created_at: string;
};

function rowToParticipant(row: ParticipantRow): Participant {
  const meta = row.metadata && typeof row.metadata === "object" ? (row.metadata as ParticipantMeta) : {};
  return { id: row.id, name: row.name, email: row.email, mobile: row.mobile, metadata: meta, created_at: row.created_at };
}

/* ── Quick-create dialog for types/subtypes ── */
function QuickCreateDialog({
  open,
  onClose,
  title,
  placeholder,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  placeholder: string;
  onConfirm: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const name = value.trim();
    if (!name) { toast.error("Name is required"); return; }
    setBusy(true);
    try {
      await onConfirm(name);
      setValue("");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setValue(""); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div>
          <Label className="mb-1.5">Name</Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setValue(""); onClose(); }} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-gradient-primary text-primary-foreground shadow-glow">
            {busy ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Stats panel (same as old $typeId.$subId page) ── */
type ParticipantStats = {
  totalAttempts: number; completedAttempts: number;
  totalCorrect: number; totalWrong: number; totalUnattempted: number;
  avgScore: number; highestScore: number; lowestScore: number;
  lastQuizAt: string | null;
  recentAttempts: { title: string; score: number; total: number; pct: number; date: string }[];
};

function ParticipantStatsPanel({ participant, onClose }: { participant: Participant; onClose: () => void }) {
  const [stats, setStats] = useState<ParticipantStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setStats(null);
    (async () => {
      const { data: attempts, error } = await supabase
        .from("quiz_attempts")
        .select("id, session_id, score, total_questions, completed, completed_at, quiz_answers ( id, is_correct )")
        .eq("participant_id", participant.id)
        .eq("completed", true)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });
      if (cancelled) return;
      if (error || !attempts?.length) {
        setStats({ totalAttempts: 0, completedAttempts: 0, totalCorrect: 0, totalWrong: 0, totalUnattempted: 0, avgScore: 0, highestScore: 0, lowestScore: 0, lastQuizAt: null, recentAttempts: [] });
        setLoading(false);
        return;
      }
      const sessionIds = Array.from(new Set(attempts.map((r) => r.session_id)));
      const { data: sessions } = await supabase.from("quiz_sessions").select("id, title").in("id", sessionIds);
      if (cancelled) return;
      const titleById = new Map((sessions ?? []).map((s) => [s.id, s.title]));
      let totalCorrect = 0; let totalWrong = 0; let totalUnattempted = 0;
      const pctScores: number[] = [];
      for (const a of attempts) {
        const answers = (a.quiz_answers ?? []) as { id: string; is_correct: boolean | null }[];
        const correct = answers.filter((x) => x.is_correct === true).length;
        const wrong = answers.filter((x) => x.is_correct === false).length;
        totalCorrect += correct; totalWrong += wrong;
        totalUnattempted += Math.max(0, a.total_questions - answers.length);
        pctScores.push(a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0);
      }
      const avgScore = pctScores.length > 0 ? Math.round(pctScores.reduce((a, b) => a + b, 0) / pctScores.length) : 0;
      setStats({
        totalAttempts: attempts.length, completedAttempts: attempts.length,
        totalCorrect, totalWrong, totalUnattempted,
        avgScore, highestScore: pctScores.length ? Math.max(...pctScores) : 0,
        lowestScore: pctScores.length ? Math.min(...pctScores) : 0,
        lastQuizAt: attempts[0]?.completed_at ?? null,
        recentAttempts: attempts.slice(0, 5).map((a) => {
          const pct = a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0;
          return { title: titleById.get(a.session_id) ?? "Unknown quiz", score: a.score, total: a.total_questions, pct, date: a.completed_at ? new Date(a.completed_at).toLocaleDateString() : "—" };
        }),
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [participant.id]);

  const initials = participant.name.slice(0, 2).toUpperCase();
  const typeBadge = participant.metadata.participant_type;

  return (
    <div className="rounded-2xl border border-primary/30 bg-card/70 shadow-glow overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary text-xs font-bold shrink-0">{initials}</div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{participant.name}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {typeBadge && <span className="capitalize mr-1">{typeBadge} ·</span>}
              {participant.email || participant.mobile || "No contact info"}
            </div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading stats…</div>
        ) : !stats || stats.totalAttempts === 0 ? (
          <div className="py-6 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No quiz history yet</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <StatTile icon={<Target className="h-3.5 w-3.5 text-primary" />} label="Quizzes" value={stats.totalAttempts} />
              <StatTile icon={<TrendingUp className="h-3.5 w-3.5 text-primary" />} label="Avg Score" value={`${stats.avgScore}%`} highlight />
              <StatTile icon={<CheckCircle2 className="h-3.5 w-3.5 text-success" />} label="Correct" value={stats.totalCorrect} color="text-success" />
              <StatTile icon={<XCircle className="h-3.5 w-3.5 text-destructive" />} label="Wrong" value={stats.totalWrong} color="text-destructive" />
              <StatTile icon={<Trophy className="h-3.5 w-3.5 text-warning" />} label="Highest" value={`${stats.highestScore}%`} color="text-warning" />
              <StatTile icon={<Trophy className="h-3.5 w-3.5 text-muted-foreground" />} label="Lowest" value={`${stats.lowestScore}%`} />
            </div>
            {stats.lastQuizAt && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                Last quiz: {new Date(stats.lastQuizAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </div>
            )}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Average performance</span>
                <span className="font-semibold">{stats.avgScore}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${stats.avgScore >= 70 ? "bg-success" : stats.avgScore >= 40 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${stats.avgScore}%` }} />
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Last {Math.min(stats.recentAttempts.length, 5)} Quizzes</div>
              <ul className="space-y-1.5">
                {stats.recentAttempts.map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/40 hover:bg-secondary/60 px-3 py-2 transition-colors">
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{a.title}</div>
                      <div className="text-[10px] text-muted-foreground">{a.date}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-xs font-bold ${a.pct >= 70 ? "text-success" : a.pct >= 40 ? "text-warning" : "text-destructive"}`}>{a.score}/{a.total}</div>
                      <div className="text-[10px] text-muted-foreground">{a.pct}%</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, color, highlight }: { icon: React.ReactNode; label: string; value: string | number; color?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 ${highlight ? "bg-primary/10 border border-primary/20" : "bg-secondary/40"}`}>
      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span></div>
      <div className={`text-lg font-bold ${color ?? (highlight ? "text-primary" : "")}`}>{value}</div>
    </div>
  );
}

/* ── Main page ── */

function ParticipantsPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onIndex = pathname === "/participant-types" || pathname === "/participant-types/";
  if (!onIndex) return <Outlet />;

  return <ParticipantsIndex />;
}

function ParticipantsIndex() {
  const { user } = useAuth();
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("__all__");
  const [selectedSubId, setSelectedSubId] = useState<string>("__all__");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [createTypeOpen, setCreateTypeOpen] = useState(false);
  const [createSubOpen, setCreateSubOpen] = useState(false);

  /* load all types + subtypes + participants */
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [tRes, sRes, pRes] = await Promise.all([
      supabase.from("participant_types").select("id, name, icon").eq("owner_id", user.id).order("created_at"),
      supabase.from("participant_subtypes").select("id, type_id, name, description").eq("owner_id", user.id).order("created_at"),
      supabase.from("participants").select("id, name, email, mobile, metadata, subtype_id, created_at").eq("owner_id", user.id).order("created_at", { ascending: false }),
    ]);
    setLoading(false);
    if (tRes.error) { toast.error(tRes.error.message); return; }
    if (pRes.error) { toast.error(pRes.error.message); return; }
    setTypes(tRes.data ?? []);
    setSubs(sRes.data ?? []);
    setParticipants(((pRes.data ?? []) as ParticipantRow[]).map(rowToParticipant));
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  /* reset subtype when type changes */
  const handleTypeChange = (v: string) => {
    setSelectedTypeId(v);
    setSelectedSubId("__all__");
    setSelectedId(null);
  };

  /* subtypes for selected type */
  const visibleSubs = useMemo(() =>
    selectedTypeId === "__all__" ? subs : subs.filter((s) => s.type_id === selectedTypeId),
    [subs, selectedTypeId]);

  /* subtype→type map for resolving participant's type */
  const subToType = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of subs) m.set(s.id, s.type_id);
    return m;
  }, [subs]);

  /* filtered participants */
  const filtered = useMemo(() => {
    let list = participants;
    if (selectedSubId !== "__all__") {
      list = list.filter((p) => p.metadata ? true : false);
      list = participants.filter((p) => {
        /* We need to match subtype_id — store it on metadata won't work; we need subtype_id field */
        return true; // placeholder — actual filter below via raw data
      });
    }
    /* For type filter we need subtype_id from raw rows — we'll keep raw rows in state */
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const haystack = [p.name, p.email, p.mobile, p.metadata.roll_number, p.metadata.organization, p.metadata.class, p.metadata.grade, p.metadata.employee_id, p.metadata.department].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [participants, selectedSubId, search]);

  /* Keep raw rows so we can filter by subtype_id */
  const [rawRows, setRawRows] = useState<(ParticipantRow & { meta: ParticipantMeta })[]>([]);

  const loadWithRaw = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [tRes, sRes, pRes] = await Promise.all([
      supabase.from("participant_types").select("id, name, icon").eq("owner_id", user.id).order("created_at"),
      supabase.from("participant_subtypes").select("id, type_id, name, description").eq("owner_id", user.id).order("created_at"),
      supabase.from("participants").select("id, name, email, mobile, metadata, subtype_id, created_at").eq("owner_id", user.id).order("created_at", { ascending: false }),
    ]);
    setLoading(false);
    if (tRes.error) { toast.error(tRes.error.message); return; }
    if (pRes.error) { toast.error(pRes.error.message); return; }
    setTypes(tRes.data ?? []);
    setSubs(sRes.data ?? []);
    const rows = (pRes.data ?? []) as ParticipantRow[];
    setRawRows(rows.map((r) => ({ ...r, meta: (r.metadata && typeof r.metadata === "object" ? r.metadata : {}) as ParticipantMeta })));
    setParticipants(rows.map(rowToParticipant));
  }, [user]);

  useEffect(() => { void loadWithRaw(); }, [loadWithRaw]);

  /* Filtered list using raw rows for subtype_id */
  const filteredParticipants = useMemo(() => {
    let list = rawRows;
    if (selectedTypeId !== "__all__") {
      list = list.filter((r) => {
        if (!r.subtype_id) return false;
        return subToType.get(r.subtype_id) === selectedTypeId;
      });
    }
    if (selectedSubId !== "__all__") {
      list = list.filter((r) => r.subtype_id === selectedSubId);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const meta = r.meta;
        const haystack = [r.name, r.email, r.mobile, meta.roll_number, meta.organization, meta.class, meta.grade, meta.employee_id, meta.department].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(q);
      });
    }
    return list.map(rowToParticipant);
  }, [rawRows, selectedTypeId, selectedSubId, search, subToType]);

  /* Stats */
  const totalCount = participants.length;
  const typeCount = types.length;
  const subCount = subs.length;

  /* CRUD */
  const createType = async (name: string) => {
    if (!user) return;
    const { error } = await supabase.from("participant_types").insert({ owner_id: user.id, name });
    if (error) { toast.error(error.message); throw error; }
    toast.success(`Type "${name}" created`);
    await loadWithRaw();
  };

  const createSub = async (name: string) => {
    if (!user || selectedTypeId === "__all__") return;
    const { data, error } = await supabase.from("participant_subtypes").insert({ owner_id: user.id, type_id: selectedTypeId, name }).select("id").single();
    if (error) { toast.error(error.message); throw error; }
    toast.success(`Sub-type "${name}" created`);
    await loadWithRaw();
    if (data) setSelectedSubId(data.id);
  };

  const createParticipant = async (draft: ParticipantDraft) => {
    if (!user) return;
    const row = draftToRow(draft, user.id);
    const subtypeId = selectedSubId !== "__all__" ? selectedSubId : null;
    const { data, error } = await supabase.from("participants").insert({ ...row, subtype_id: subtypeId }).select("id, name, email, mobile, metadata, subtype_id, created_at").single();
    if (error) { toast.error(error.message); throw error; }
    if (data) {
      const prow = data as ParticipantRow;
      setRawRows((prev) => [{ ...prow, meta: (prow.metadata && typeof prow.metadata === "object" ? prow.metadata : {}) as ParticipantMeta }, ...prev]);
      setParticipants((prev) => [rowToParticipant(prow), ...prev]);
      toast.success(`Added ${data.name}`);
    }
  };

  const createMany = async (drafts: ParticipantDraft[]) => {
    if (!user || drafts.length === 0) return;
    const subtypeId = selectedSubId !== "__all__" ? selectedSubId : null;
    const rows = drafts.map((d) => ({ ...draftToRow(d, user.id), subtype_id: subtypeId }));
    const { data, error } = await supabase.from("participants").insert(rows).select("id, name, email, mobile, metadata, subtype_id, created_at");
    if (error) { toast.error(error.message); throw error; }
    const inserted = ((data ?? []) as ParticipantRow[]);
    setRawRows((prev) => [...inserted.map((r) => ({ ...r, meta: (r.metadata && typeof r.metadata === "object" ? r.metadata : {}) as ParticipantMeta })), ...prev]);
    setParticipants((prev) => [...inserted.map(rowToParticipant), ...prev]);
    toast.success(`Added ${inserted.length} participant${inserted.length === 1 ? "" : "s"}`);
  };

  const updateParticipant = async (id: string, draft: ParticipantDraft) => {
    if (!user) return;
    const row = draftToRow(draft, user.id);
    const { error } = await supabase.from("participants").update({ name: row.name, email: row.email, mobile: row.mobile, metadata: row.metadata }).eq("id", id);
    if (error) { toast.error(error.message); throw error; }
    setRawRows((prev) => prev.map((r) => r.id === id ? { ...r, name: row.name, email: row.email, mobile: row.mobile, metadata: row.metadata, meta: row.metadata as ParticipantMeta } : r));
    setParticipants((prev) => prev.map((p) => p.id === id ? { ...p, name: row.name, email: row.email, mobile: row.mobile, metadata: row.metadata as ParticipantMeta } : p));
    toast.success("Participant updated");
  };

  const removeParticipant = async (id: string) => {
    const { error } = await supabase.from("participants").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRawRows((prev) => prev.filter((r) => r.id !== id));
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId(null);
    toast.success("Participant removed");
  };

  const generateInvites = async (emails: string[]): Promise<InviteRow[]> => {
    if (!user) return [];
    const subtypeId = selectedSubId !== "__all__" ? selectedSubId : null;
    if (!subtypeId) { toast.error("Select a sub-type first to generate invite links."); return []; }
    const inputs = (emails.length > 0
      ? emails.map((e) => ({ owner_id: user.id, subtype_id: subtypeId, email: e as string | null }))
      : [{ owner_id: user.id, subtype_id: subtypeId, email: null as string | null }]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.from("participant_invites").insert(inputs as any).select("id, email, token");
    if (error) { toast.error(error.message); throw error; }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return (data ?? []).map((r) => ({ email: r.email, token: r.token, url: `${origin}/invite/${r.token}` }));
  };

  const selectedParticipant = selectedId ? (participants.find((p) => p.id === selectedId) ?? null) : null;
  const navigate = useNavigate();
  const selectedSubName = subs.find((s) => s.id === selectedSubId)?.name ?? "this group";
  const canAddSub = selectedTypeId !== "__all__";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Manage Participants</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Organise your roster by type and sub-type. Select a group below to view and manage participants.
          </p>
        </div>
        <Button
          className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          onClick={() => navigate({ to: "/participant-types/add" })}
        >
          <UserPlus className="h-4 w-4" /> Add Participant
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Type select */}
        <div className="flex-1 min-w-[180px] max-w-[240px]">
          <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
          <div className="flex gap-1">
            <Select value={selectedTypeId} onValueChange={handleTypeChange}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All types</SelectItem>
                {types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" title="New type" onClick={() => setCreateTypeOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Sub-type select */}
        <div className="flex-1 min-w-[180px] max-w-[240px]">
          <Label className="text-xs text-muted-foreground mb-1 block">Sub-type</Label>
          <div className="flex gap-1">
            <Select value={selectedSubId} onValueChange={(v) => { setSelectedSubId(v); setSelectedId(null); }} disabled={selectedTypeId === "__all__"}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={selectedTypeId === "__all__" ? "Pick a type first" : "All sub-types"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All sub-types</SelectItem>
                {visibleSubs.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" title="New sub-type" disabled={!canAddSub} onClick={() => setCreateSubOpen(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Label className="text-xs text-muted-foreground mb-1 block">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, roll number…"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Stats summary row */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Types", value: typeCount, color: "bg-primary/10 text-primary" },
          { label: "Sub-types", value: subCount, color: "bg-secondary/60 text-muted-foreground" },
          { label: "Total participants", value: totalCount, color: "bg-secondary/60 text-muted-foreground" },
          { label: "Showing", value: filteredParticipants.length, color: "bg-success/10 text-success" },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl px-4 py-2 text-xs font-semibold ${s.color}`}>
            {s.label}: <span className="text-base font-bold ml-1">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className={`flex gap-4 items-start ${selectedParticipant ? "lg:flex-row flex-col" : ""}`}>
        <div className={`min-w-0 ${selectedParticipant ? "lg:flex-1" : "w-full"}`}>
          {loading ? (
            <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">Loading participants…</div>
          ) : filteredParticipants.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
              <UsersRound className="mx-auto h-10 w-10 text-muted-foreground/60" />
              {totalCount === 0 ? (
                <>
                  <p className="mt-3 text-sm font-medium">No participants yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">First create a Type (e.g. Student), then add participants.</p>
                </>
              ) : selectedTypeId === "__all__" ? (
                <>
                  <p className="mt-3 text-sm font-medium">No matches</p>
                  <p className="mt-1 text-xs text-muted-foreground">Try a different search or filter.</p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm font-medium">No participants in this group</p>
                  <p className="mt-1 text-xs text-muted-foreground">Add them manually, upload a file, or generate invite links.</p>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="hidden md:table-cell">Details</TableHead>
                    <TableHead className="hidden lg:table-cell">Organization</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParticipants.map((p) => (
                    <ParticipantTableRow
                      key={p.id}
                      p={p}
                      selected={selectedId === p.id}
                      onSelect={() => setSelectedId((prev) => (prev === p.id ? null : p.id))}
                      onUpdate={updateParticipant}
                      onDelete={removeParticipant}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {selectedParticipant && (
          <div className="lg:w-80 w-full shrink-0">
            <ParticipantStatsPanel participant={selectedParticipant} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </div>

      {/* Quick-create dialogs */}
      <QuickCreateDialog
        open={createTypeOpen}
        onClose={() => setCreateTypeOpen(false)}
        title="New participant type"
        placeholder="e.g. Student, Teacher, Employee"
        onConfirm={createType}
      />
      <QuickCreateDialog
        open={createSubOpen}
        onClose={() => setCreateSubOpen(false)}
        title="New sub-type"
        placeholder="e.g. Class 9, Engineering Team"
        onConfirm={createSub}
      />
    </div>
  );
}

/* ── Table row ── */

function ParticipantTableRow({ p, selected, onSelect, onUpdate, onDelete }: {
  p: Participant; selected: boolean;
  onSelect: () => void;
  onUpdate: (id: string, d: ParticipantDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const ptype = p.metadata.participant_type;
  const typeEmoji = ptype === "student" ? "🎓" : ptype === "teacher" ? "📚" : ptype === "employee" ? "💼" : ptype === "fun" ? "🎉" : "";

  return (
    <TableRow
      className={`cursor-pointer transition-colors ${selected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/30"}`}
      onClick={onSelect}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          {selected ? <ChevronUp className="h-3.5 w-3.5 text-primary shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <div>
            <div className={`font-medium flex items-center gap-1 ${selected ? "text-primary" : ""}`}>
              {typeEmoji && <span>{typeEmoji}</span>}
              {p.name}
            </div>
            {(p.metadata.class || p.metadata.grade) && <div className="text-xs text-muted-foreground">{p.metadata.class || p.metadata.grade}</div>}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm space-y-0.5">
          {p.email && <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3 w-3" /><span className="truncate max-w-[200px]">{p.email}</span></div>}
          {p.mobile && <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3" />{p.mobile}</div>}
          {!p.email && !p.mobile && <span className="text-xs text-muted-foreground">—</span>}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="text-xs space-y-0.5">
          {p.metadata.roll_number && <div className="flex items-center gap-1.5"><Hash className="h-3 w-3 text-muted-foreground" />{p.metadata.roll_number}</div>}
          {p.metadata.employee_id && <div className="flex items-center gap-1.5"><Hash className="h-3 w-3 text-muted-foreground" />{p.metadata.employee_id}</div>}
          {p.metadata.seat_number && <div className="flex items-center gap-1.5"><Armchair className="h-3 w-3 text-muted-foreground" />{p.metadata.seat_number}</div>}
          {p.metadata.department && <div className="text-muted-foreground">{p.metadata.department}</div>}
          {!p.metadata.roll_number && !p.metadata.employee_id && !p.metadata.seat_number && !p.metadata.department && <span className="text-muted-foreground">—</span>}
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
        {p.metadata.organization || "—"}
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-1">
          <ParticipantDialog
            title="Edit participant"
            submitLabel="Save changes"
            initial={draftFromParticipant(p)}
            onSubmit={(d) => onUpdate(p.id, d)}
            trigger={
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
          <DeleteParticipantButton p={p} onConfirm={onDelete} />
        </div>
      </TableCell>
    </TableRow>
  );
}

function DeleteParticipantButton({ p, onConfirm }: { p: Participant; onConfirm: (id: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {p.name}?</AlertDialogTitle>
          <AlertDialogDescription>They'll be removed from your roster. Past quiz attempts are kept.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault(); setBusy(true);
              try { await onConfirm(p.id); setOpen(false); } finally { setBusy(false); }
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
