import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Armchair, BarChart3, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronUp,
  Hash, Mail, Pencil, Phone, Plus, Search, Target, Trash2, TrendingUp,
  Trophy, UserPlus, Users, UsersRound, X, XCircle, FolderPlus,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ParticipantDialog } from "@/components/participants/ParticipantDialog";
import { InviteDialog, type InviteRow } from "@/components/participants/InviteDialog";
import { UploadParticipantsDialog } from "@/components/participants/UploadParticipantsDialog";
import { ScanParticipantsDialog } from "@/components/participants/ScanParticipantsDialog";
import { PaginationControls } from "@/components/PaginationControls";
import { draftFromParticipant, draftToRow, type Participant, type ParticipantDraft, type ParticipantMeta } from "@/components/participants/types";

export const Route = createFileRoute("/_app/participant-types")({ component: ParticipantsPage });
const PARTICIPANT_PAGE_SIZE = 25;

type TypeRow = { id: string; name: string; icon: string | null };
type SubRow  = { id: string; type_id: string; name: string; description: string | null };
type ParticipantRow = {
  id: string; name: string; email: string | null; mobile: string | null;
  metadata: unknown; subtype_id: string | null; created_at: string;
};

function rowToParticipant(row: ParticipantRow): Participant {
  const meta = row.metadata && typeof row.metadata === "object" ? (row.metadata as ParticipantMeta) : {};
  return { id: row.id, name: row.name, email: row.email, mobile: row.mobile, metadata: meta, created_at: row.created_at };
}

/* ── Quick-create dialog ── */
function QuickCreateDialog({ open, onClose, title, placeholder, onConfirm }: {
  open: boolean; onClose: () => void; title: string; placeholder: string;
  onConfirm: (name: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!value.trim()) { toast.error(t("common.required")); return; }
    setBusy(true);
    try { await onConfirm(value.trim()); setValue(""); onClose(); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setValue(""); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div>
          <Label className="mb-1.5 text-xs">Name *</Label>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder}
            className="h-11" autoFocus onKeyDown={(e) => { if (e.key === "Enter") void submit(); }} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setValue(""); onClose(); }} disabled={busy}>{t("common.cancel")}</Button>
          <Button onClick={submit} disabled={busy || !value.trim()} className="bg-gradient-primary text-primary-foreground shadow-glow">
            {busy ? t("cat.creating") : t("common.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Chip selector — all options visible, one tap (Hick's Law) ── */
function ChipSelector({ items, selected, onSelect, allLabel }: {
  items: { id: string; label: string; count?: number }[];
  selected: string; onSelect: (id: string) => void; allLabel?: string;
}) {
  const allItem = { id: "__all__", label: allLabel ?? "All", count: items.reduce((s, i) => s + (i.count ?? 0), 0) };
  const opts = [allItem, ...items];
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((item) => (
        <button key={item.id} type="button" onClick={() => onSelect(item.id)}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium min-h-[40px] transition-all ${
            selected === item.id
              ? "bg-primary text-primary-foreground border-primary shadow-glow"
              : "bg-card/60 border-border text-foreground hover:border-primary/50 hover:bg-primary/5"
          }`}>
          {selected === item.id && <Check size={12} />}
          {item.label}
          {item.count !== undefined && (
            <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-semibold ${
              selected === item.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>{item.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ── Stats panel ── */
type ParticipantStats = {
  totalAttempts: number; totalCorrect: number; totalWrong: number;
  avgScore: number; highestScore: number; lowestScore: number;
  lastQuizAt: string | null;
  recentAttempts: { title: string; score: number; total: number; pct: number; date: string }[];
};

function ParticipantStatsPanel({ participant, onClose }: { participant: Participant; onClose: () => void }) {
  const [stats, setStats] = useState<ParticipantStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setStats(null);
    (async () => {
      const { data: attempts, error } = await supabase
        .from("quiz_attempts")
        .select("id, session_id, score, total_questions, completed, completed_at, quiz_answers ( id, is_correct )")
        .eq("participant_id", participant.id).eq("completed", true)
        .not("completed_at", "is", null).order("completed_at", { ascending: false });
      if (cancelled) return;
      if (error || !attempts?.length) {
        setStats({ totalAttempts: 0, totalCorrect: 0, totalWrong: 0, avgScore: 0, highestScore: 0, lowestScore: 0, lastQuizAt: null, recentAttempts: [] });
        setLoading(false); return;
      }
      const sessionIds = Array.from(new Set(attempts.map((r) => r.session_id)));
      const { data: sessions } = await supabase.from("quiz_sessions").select("id, title").in("id", sessionIds);
      if (cancelled) return;
      const titleById = new Map((sessions ?? []).map((s) => [s.id, s.title]));
      let totalCorrect = 0; let totalWrong = 0;
      const pctScores: number[] = [];
      for (const a of attempts) {
        const answers = (a.quiz_answers ?? []) as { id: string; is_correct: boolean | null }[];
        totalCorrect += answers.filter((x) => x.is_correct === true).length;
        totalWrong   += answers.filter((x) => x.is_correct === false).length;
        pctScores.push(a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0);
      }
      const avgScore = pctScores.length > 0 ? Math.round(pctScores.reduce((a, b) => a + b, 0) / pctScores.length) : 0;
      setStats({
        totalAttempts: attempts.length, totalCorrect, totalWrong,
        avgScore, highestScore: pctScores.length ? Math.max(...pctScores) : 0,
        lowestScore: pctScores.length ? Math.min(...pctScores) : 0,
        lastQuizAt: attempts[0]?.completed_at ?? null,
        recentAttempts: attempts.slice(0, 5).map((a) => {
          const pct = a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0;
          return { title: titleById.get(a.session_id) ?? "Unknown quiz", score: a.score, total: a.total_questions, pct, date: a.completed_at ? new Date(a.completed_at).toLocaleDateString() : "-" };
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
      {/* Header */}
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
        <button type="button" onClick={onClose} aria-label="Close stats"
          className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors shrink-0 min-h-[32px] min-w-[32px] flex items-center justify-center">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground animate-pulse">Loading stats…</div>
        ) : !stats || stats.totalAttempts === 0 ? (
          <div className="py-6 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No quiz history yet</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <StatTile icon={<Target className="h-3.5 w-3.5 text-primary" />} label="Quizzes"   value={stats.totalAttempts} />
              <StatTile icon={<TrendingUp className="h-3.5 w-3.5 text-primary" />} label="Avg Score" value={`${stats.avgScore}%`} highlight />
              <StatTile icon={<CheckCircle2 className="h-3.5 w-3.5 text-success" />} label="Correct"  value={stats.totalCorrect} color="text-success" />
              <StatTile icon={<XCircle className="h-3.5 w-3.5 text-destructive" />} label="Wrong"    value={stats.totalWrong}   color="text-destructive" />
              <StatTile icon={<Trophy className="h-3.5 w-3.5 text-warning" />} label="Highest" value={`${stats.highestScore}%`} color="text-warning" />
              <StatTile icon={<Trophy className="h-3.5 w-3.5 text-muted-foreground" />} label="Lowest" value={`${stats.lowestScore}%`} />
            </div>
            {stats.lastQuizAt && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                Last quiz: {new Date(stats.lastQuizAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
              </div>
            )}
            {/* Performance bar */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Average performance</span>
                <span className="font-bold">{stats.avgScore}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${stats.avgScore >= 70 ? "bg-success" : stats.avgScore >= 40 ? "bg-warning" : "bg-destructive"}`}
                  style={{ width: `${stats.avgScore}%` }} />
              </div>
            </div>
            {/* Recent quizzes */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Last {Math.min(stats.recentAttempts.length, 5)} Quizzes
              </div>
              <ul className="space-y-1.5">
                {stats.recentAttempts.map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-xl bg-secondary/40 px-3 py-2">
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

/* ── Page router ── */
function ParticipantsPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onIndex = pathname === "/participant-types" || pathname === "/participant-types/";
  if (!onIndex) return <Outlet />;
  return <ParticipantsIndex />;
}

/* ── Main index ── */
function ParticipantsIndex() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [types, setTypes]               = useState<TypeRow[]>([]);
  const [subs, setSubs]                 = useState<SubRow[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [rawRows, setRawRows]           = useState<(ParticipantRow & { meta: ParticipantMeta })[]>([]);
  const [loading, setLoading]           = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("__all__");
  const [selectedSubId, setSelectedSubId]   = useState<string>("__all__");
  const [search, setSearch]             = useState("");
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [page, setPage]                 = useState(0);
  const [participantTotal, setParticipantTotal] = useState(0);
  const [createTypeOpen, setCreateTypeOpen] = useState(false);
  const [createSubOpen, setCreateSubOpen]   = useState(false);

  // Per-type participant counts (for chip badges)
  const [typeCounts, setTypeCounts] = useState<Map<string, number>>(new Map());
  const [subCounts, setSubCounts]   = useState<Map<string, number>>(new Map());

  const handleTypeChange = (v: string) => { setSelectedTypeId(v); setSelectedSubId("__all__"); setSelectedId(null); };

  const visibleSubs = useMemo(
    () => selectedTypeId === "__all__" ? subs : subs.filter((s) => s.type_id === selectedTypeId),
    [subs, selectedTypeId],
  );

  const loadWithRaw = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const from = page * PARTICIPANT_PAGE_SIZE;
    const to   = from + PARTICIPANT_PAGE_SIZE - 1;
    const searchTerm = search.trim();

    const subtypeRes = await supabase.from("participant_subtypes")
      .select("id, type_id, name, description").eq("owner_id", user.id).order("created_at");
    const subRows = subtypeRes.data ?? [];

    let pQuery = supabase.from("participants")
      .select("id, name, email, mobile, metadata, subtype_id, created_at", { count: "exact" })
      .eq("owner_id", user.id).order("created_at", { ascending: false }).range(from, to);

    if (selectedSubId !== "__all__") {
      pQuery = pQuery.eq("subtype_id", selectedSubId);
    } else if (selectedTypeId !== "__all__") {
      const ids = subRows.filter((s) => s.type_id === selectedTypeId).map((s) => s.id);
      if (ids.length === 0) {
        setTypes([]); setSubs(subRows); setRawRows([]); setParticipants([]); setParticipantTotal(0); setLoading(false); return;
      }
      pQuery = pQuery.in("subtype_id", ids);
    }
    if (searchTerm) pQuery = pQuery.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,mobile.ilike.%${searchTerm}%`);

    const [tRes, pRes, allPartsRes] = await Promise.all([
      supabase.from("participant_types").select("id, name, icon").eq("owner_id", user.id).order("created_at"),
      pQuery,
      // load all subtype_ids for count badges (no range)
      supabase.from("participants").select("subtype_id").eq("owner_id", user.id),
    ]);

    setLoading(false);
    if (tRes.error) { toast.error(tRes.error.message); return; }
    if (pRes.error) { toast.error(pRes.error.message); return; }

    setTypes(tRes.data ?? []);
    setSubs(subRows);
    setParticipantTotal(pRes.count ?? 0);

    // compute counts for chip badges
    const sc = new Map<string, number>();
    for (const r of allPartsRes.data ?? []) {
      if (r.subtype_id) sc.set(r.subtype_id, (sc.get(r.subtype_id) ?? 0) + 1);
    }
    setSubCounts(sc);
    const tc = new Map<string, number>();
    for (const sub of subRows) tc.set(sub.type_id, (tc.get(sub.type_id) ?? 0) + (sc.get(sub.id) ?? 0));
    setTypeCounts(tc);

    const rows = (pRes.data ?? []) as ParticipantRow[];
    setRawRows(rows.map((r) => ({ ...r, meta: (r.metadata && typeof r.metadata === "object" ? r.metadata : {}) as ParticipantMeta })));
    setParticipants(rows.map(rowToParticipant));
  }, [user, page, search, selectedTypeId, selectedSubId]);

  useEffect(() => { void loadWithRaw(); }, [loadWithRaw]);
  useEffect(() => { setPage(0); }, [selectedTypeId, selectedSubId, search]);

  const filteredParticipants = useMemo(() => rawRows.map(rowToParticipant), [rawRows]);

  /* ── CRUD ── */
  const createType = async (name: string) => {
    if (!user) return;
    const { error } = await supabase.from("participant_types").insert({ owner_id: user.id, name });
    if (error) { toast.error(error.message); throw error; }
    toast.success(t("pt.typeCreated").replace("{name}", name));
    await loadWithRaw();
  };

  const createSub = async (name: string) => {
    if (!user || selectedTypeId === "__all__") return;
    const { data, error } = await supabase.from("participant_subtypes")
      .insert({ owner_id: user.id, type_id: selectedTypeId, name }).select("id").single();
    if (error) { toast.error(error.message); throw error; }
    toast.success(t("pt.groupCreated").replace("{name}", name));
    await loadWithRaw();
    if (data) setSelectedSubId(data.id);
  };

  const createParticipant = async (draft: ParticipantDraft) => {
    if (!user) return;
    const row = draftToRow(draft, user.id);
    const subtypeId = selectedSubId !== "__all__" ? selectedSubId : null;
    const { data, error } = await supabase.from("participants")
      .insert({ ...row, subtype_id: subtypeId })
      .select("id, name, email, mobile, metadata, subtype_id, created_at").single();
    if (error) { toast.error(error.message); throw error; }
    if (data) { toast.success(t("pt.participantAdded").replace("{name}", data.name)); setPage(0); await loadWithRaw(); }
  };

  const createMany = async (drafts: ParticipantDraft[]) => {
    if (!user || drafts.length === 0) return;
    const subtypeId = selectedSubId !== "__all__" ? selectedSubId : null;
    const rows = drafts.map((d) => ({ ...draftToRow(d, user.id), subtype_id: subtypeId }));
    const { data, error } = await supabase.from("participants").insert(rows).select("id, name, email, mobile, metadata, subtype_id, created_at");
    if (error) { toast.error(error.message); throw error; }
    const inserted = (data ?? []) as ParticipantRow[];
    toast.success(`${t("pt.added")} ${inserted.length} ${inserted.length === 1 ? t("pt.participant") : t("pt.participants")}`);
    setPage(0); await loadWithRaw();
  };

  const updateParticipant = async (id: string, draft: ParticipantDraft) => {
    if (!user) return;
    const row = draftToRow(draft, user.id);
    const { error } = await supabase.from("participants").update({ name: row.name, email: row.email, mobile: row.mobile, metadata: row.metadata }).eq("id", id);
    if (error) { toast.error(error.message); throw error; }
    setRawRows((prev) => prev.map((r) => r.id === id ? { ...r, name: row.name, email: row.email, mobile: row.mobile, metadata: row.metadata, meta: row.metadata as ParticipantMeta } : r));
    toast.success(t("pt.participantUpdated"));
  };

  const removeParticipant = async (id: string) => {
    const { error } = await supabase.from("participants").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (selectedId === id) setSelectedId(null);
    toast.success(t("pt.participantRemoved"));
    await loadWithRaw();
  };

  const generateInvites = async (emails: string[]): Promise<InviteRow[]> => {
    if (!user) return [];
    const subtypeId = selectedSubId !== "__all__" ? selectedSubId : null;
    if (!subtypeId) { toast.error(t("pt.selectGroupFirst")); return []; }
    const inputs = emails.length > 0
      ? emails.map((e) => ({ owner_id: user.id, subtype_id: subtypeId, email: e as string | null }))
      : [{ owner_id: user.id, subtype_id: subtypeId, email: null as string | null }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.from("participant_invites").insert(inputs as any).select("id, email, token");
    if (error) { toast.error(error.message); throw error; }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return (data ?? []).map((r) => ({ email: r.email, token: r.token, url: `${origin}/invite/${r.token}` }));
  };

  const selectedParticipant = selectedId ? (filteredParticipants.find((p) => p.id === selectedId) ?? null) : null;
  const canAddSub = selectedTypeId !== "__all__";
  const totalAll  = Array.from(typeCounts.values()).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">

      {/* ── Hero header ── */}
      <div className="rounded-2xl border border-border bg-card/60 p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> {t("pt.manageTitle")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {totalAll > 0
              ? `${totalAll} participants across ${types.length} ${types.length === 1 ? "type" : "types"}`
              : t("pt.manageDesc")}
          </p>
        </div>
        <Button
          className="h-11 gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          onClick={() => navigate({ to: "/participant-types/add" })}
        >
          <UserPlus className="h-4 w-4" /> {t("pt.addParticipant")}
        </Button>
      </div>

      {/* ── Step 1: Type filter chips ── */}
      <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("pt.type")}</div>
          <button type="button" onClick={() => setCreateTypeOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-all">
            <FolderPlus size={12} /> New Type
          </button>
        </div>
        {types.length === 0 ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-xs text-muted-foreground">No participant types yet.</p>
            <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setCreateTypeOpen(true)}>
              <Plus size={13} /> Create first type
            </Button>
          </div>
        ) : (
          <ChipSelector
            items={types.map((t) => ({ id: t.id, label: t.name, count: typeCounts.get(t.id) ?? 0 }))}
            selected={selectedTypeId}
            onSelect={handleTypeChange}
            allLabel={t("pt.allTypes")}
          />
        )}

        {/* Step 2: Group chips — progressive disclosure */}
        {selectedTypeId !== "__all__" && (
          <div className="pt-3 border-t border-border/50 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("pt.group")}</div>
              <button type="button" onClick={() => setCreateSubOpen(true)} disabled={!canAddSub}
                className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-all disabled:opacity-40">
                <Plus size={12} /> New Group
              </button>
            </div>
            {visibleSubs.length === 0 ? (
              <div className="text-center py-3 space-y-2">
                <p className="text-xs text-muted-foreground">No groups in this type yet.</p>
                <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setCreateSubOpen(true)}>
                  <Plus size={13} /> Add first group
                </Button>
              </div>
            ) : (
              <ChipSelector
                items={visibleSubs.map((s) => ({ id: s.id, label: s.name, count: subCounts.get(s.id) ?? 0 }))}
                selected={selectedSubId}
                onSelect={(v) => { setSelectedSubId(v); setSelectedId(null); }}
                allLabel={t("pt.allGroups")}
              />
            )}
          </div>
        )}
      </div>

      {/* ── Search + action row ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t("pt.searchPlaceholder")} className="pl-9 h-11" />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>
        {/* Quick-add actions */}
        <div className="flex items-center gap-2 shrink-0">
          <UploadParticipantsDialog onImport={createMany}
            trigger={<Button variant="outline" size="sm" className="h-11 gap-1.5 hidden sm:flex">Upload CSV</Button>} />
          <ScanParticipantsDialog onImport={createMany}
            trigger={<Button variant="outline" size="sm" className="h-11 gap-1.5 hidden sm:flex">Scan</Button>} />
          <InviteDialog onGenerate={generateInvites}
            trigger={<Button variant="outline" size="sm" className="h-11 gap-1.5">Invite</Button>} />
          <ParticipantDialog title={t("pt.addTitle")} submitLabel={t("pt.addBtn")} onSubmit={createParticipant}
            trigger={<Button size="sm" className="h-11 gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow"><Plus size={14} /> Add</Button>} />
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("pt.totalParticipants")}</div>
          <div className="font-display text-2xl font-bold mt-1">{totalAll}</div>
        </div>
        <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("pt.showing")}</div>
          <div className="font-display text-2xl font-bold mt-1 text-primary">{participantTotal}</div>
        </div>
        <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("pt.types")}</div>
          <div className="font-display text-2xl font-bold mt-1">{types.length}</div>
        </div>
      </div>

      {/* ── Main content: table + stats panel ── */}
      <div className={`flex gap-4 items-start ${selectedParticipant ? "lg:flex-row flex-col" : ""}`}>
        <div className={`min-w-0 ${selectedParticipant ? "lg:flex-1" : "w-full"}`}>
          {loading ? (
            <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground animate-pulse">{t("pt.loading")}</div>
          ) : filteredParticipants.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center space-y-3">
              <UsersRound className="mx-auto h-10 w-10 text-muted-foreground/40" />
              {totalAll === 0 ? (
                <>
                  <p className="text-sm font-semibold">{t("pt.empty")}</p>
                  <p className="text-xs text-muted-foreground">{t("pt.emptyHint")}</p>
                  <Button size="sm" className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow"
                    onClick={() => navigate({ to: "/participant-types/add" })}>
                    <UserPlus size={14} /> Add first participant
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold">{t("pt.noMatches")}</p>
                  <p className="text-xs text-muted-foreground">{t("pt.noMatchesHint")}</p>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("pt.colName")}</TableHead>
                    <TableHead>{t("pt.colContact")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("pt.colDetails")}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t("pt.colOrg")}</TableHead>
                    <TableHead className="w-[100px] text-right">{t("pt.colActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParticipants.map((p) => (
                    <ParticipantTableRow
                      key={p.id} p={p}
                      selected={selectedId === p.id}
                      onSelect={() => setSelectedId((prev) => (prev === p.id ? null : p.id))}
                      onUpdate={updateParticipant}
                      onDelete={removeParticipant}
                    />
                  ))}
                </TableBody>
              </Table>
              <div className="px-4 py-3 border-t border-border">
                <PaginationControls
                  page={page}
                  pageSize={PARTICIPANT_PAGE_SIZE}
                  total={participantTotal}
                  label="participants"
                  onPageChange={(p) => { setPage(p); }}
                />
              </div>
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
      <QuickCreateDialog open={createTypeOpen} onClose={() => setCreateTypeOpen(false)}
        title={t("pt.newType")} placeholder={t("pt.newTypePlaceholder")} onConfirm={createType} />
      <QuickCreateDialog open={createSubOpen} onClose={() => setCreateSubOpen(false)}
        title={t("pt.newGroup")} placeholder={t("pt.newGroupPlaceholder")} onConfirm={createSub} />
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
  const { t } = useI18n();
  const ptype = p.metadata.participant_type;
  const typeEmoji = ptype === "student" ? "🎓" : ptype === "teacher" ? "📚" : ptype === "employee" ? "💼" : ptype === "fun" ? "🎉" : "";

  return (
    <TableRow
      className={`cursor-pointer transition-colors min-h-[52px] ${selected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/30"}`}
      onClick={onSelect}
    >
      <TableCell className="py-3">
        <div className="flex items-center gap-2">
          {selected ? <ChevronUp className="h-3.5 w-3.5 text-primary shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <div>
            <div className={`font-medium flex items-center gap-1 text-sm ${selected ? "text-primary" : ""}`}>
              {typeEmoji && <span>{typeEmoji}</span>}
              {p.name}
            </div>
            {(p.metadata.class || p.metadata.grade) && (
              <div className="text-xs text-muted-foreground">{p.metadata.class || p.metadata.grade}</div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <div className="text-sm space-y-0.5">
          {p.email  && <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="h-3 w-3 shrink-0" /><span className="truncate max-w-[180px]">{p.email}</span></div>}
          {p.mobile && <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="h-3 w-3 shrink-0" />{p.mobile}</div>}
          {!p.email && !p.mobile && <span className="text-xs text-muted-foreground">—</span>}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell py-3">
        <div className="text-xs space-y-0.5">
          {p.metadata.roll_number  && <div className="flex items-center gap-1.5"><Hash className="h-3 w-3 text-muted-foreground" />{p.metadata.roll_number}</div>}
          {p.metadata.employee_id  && <div className="flex items-center gap-1.5"><Hash className="h-3 w-3 text-muted-foreground" />{p.metadata.employee_id}</div>}
          {p.metadata.seat_number  && <div className="flex items-center gap-1.5"><Armchair className="h-3 w-3 text-muted-foreground" />{p.metadata.seat_number}</div>}
          {p.metadata.department   && <div className="text-muted-foreground">{p.metadata.department}</div>}
          {!p.metadata.roll_number && !p.metadata.employee_id && !p.metadata.seat_number && !p.metadata.department && <span className="text-muted-foreground">—</span>}
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground py-3">
        {p.metadata.organization || "—"}
      </TableCell>
      <TableCell className="text-right py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-1">
          <ParticipantDialog title={t("pt.editTitle")} submitLabel={t("pt.saveChanges")}
            initial={draftFromParticipant(p)} onSubmit={(d) => onUpdate(p.id, d)}
            trigger={
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Edit">
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
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setOpen(true)} title="Delete">
        <Trash2 className="h-4 w-4" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("pt.removeTitle").replace("{name}", p.name)}</AlertDialogTitle>
          <AlertDialogDescription>{t("pt.removeDesc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction disabled={busy}
            onClick={async (e) => { e.preventDefault(); setBusy(true); try { await onConfirm(p.id); setOpen(false); } finally { setBusy(false); } }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {busy ? t("pt.deleting") : t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
