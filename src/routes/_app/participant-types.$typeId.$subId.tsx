import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Armchair,
  ChevronLeft,
  Hash,
  Mail,
  Pencil,
  Phone,
  ScanLine,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Users,
  UsersRound,
  X,
  BarChart3,
  CheckCircle2,
  XCircle,
  Trophy,
  TrendingUp,
  CalendarDays,
  Target,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/_app/participant-types/$typeId/$subId")({
  component: SubTypeParticipantsPage,
});

type SubRow = { id: string; type_id: string; name: string };
type TypeRow = { id: string; name: string };

type ParticipantRow = {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  metadata: unknown;
  subtype_id: string | null;
  created_at: string;
};

type ParticipantStats = {
  totalAttempts: number;
  completedAttempts: number;
  totalCorrect: number;
  totalWrong: number;
  totalUnattempted: number;
  avgScore: number;
  highestScore: number;
  lowestScore: number;
  lastQuizAt: string | null;
  recentAttempts: { title: string; score: number; total: number; pct: number; date: string }[];
};

function rowToParticipant(row: ParticipantRow): Participant {
  const meta =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as ParticipantMeta) : {};
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    mobile: row.mobile,
    metadata: meta,
    created_at: row.created_at,
  };
}

function SubTypeParticipantsPage() {
  const { typeId, subId } = Route.useParams();
  const { user } = useAuth();
  const [type, setType] = useState<TypeRow | null>(null);
  const [sub, setSub] = useState<SubRow | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [t, s, p] = await Promise.all([
      supabase
        .from("participant_types")
        .select("id, name")
        .eq("id", typeId)
        .eq("owner_id", user.id)
        .maybeSingle(),
      supabase
        .from("participant_subtypes")
        .select("id, type_id, name")
        .eq("id", subId)
        .eq("owner_id", user.id)
        .maybeSingle(),
      supabase
        .from("participants")
        .select("id, name, email, mobile, metadata, subtype_id, created_at")
        .eq("owner_id", user.id)
        .eq("subtype_id", subId)
        .order("created_at", { ascending: false }),
    ]);
    setLoading(false);
    if (t.error) toast.error(t.error.message);
    if (s.error) toast.error(s.error.message);
    if (p.error) toast.error(p.error.message);
    setType(t.data ?? null);
    setSub(s.data ?? null);
    setParticipants(((p.data ?? []) as ParticipantRow[]).map(rowToParticipant));
  }, [user, typeId, subId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (draft: ParticipantDraft) => {
    if (!user) return;
    const row = draftToRow(draft, user.id);
    const { data, error } = await supabase
      .from("participants")
      .insert({ ...row, subtype_id: subId })
      .select("id, name, email, mobile, metadata, subtype_id, created_at")
      .single();
    if (error) { toast.error(error.message); throw error; }
    if (data) {
      setParticipants((prev) => [rowToParticipant(data as ParticipantRow), ...prev]);
      toast.success(`Added ${data.name}`);
    }
  };

  const createMany = async (drafts: ParticipantDraft[]) => {
    if (!user || drafts.length === 0) return;
    const rows = drafts.map((d) => ({ ...draftToRow(d, user.id), subtype_id: subId }));
    const { data, error } = await supabase
      .from("participants")
      .insert(rows)
      .select("id, name, email, mobile, metadata, subtype_id, created_at");
    if (error) { toast.error(error.message); throw error; }
    const inserted = ((data ?? []) as ParticipantRow[]).map(rowToParticipant);
    setParticipants((prev) => [...inserted, ...prev]);
    toast.success(`Added ${inserted.length} participant${inserted.length === 1 ? "" : "s"}`);
  };

  const update = async (id: string, draft: ParticipantDraft) => {
    if (!user) return;
    const row = draftToRow(draft, user.id);
    const { error } = await supabase
      .from("participants")
      .update({ name: row.name, email: row.email, mobile: row.mobile, metadata: row.metadata })
      .eq("id", id);
    if (error) { toast.error(error.message); throw error; }
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, name: row.name, email: row.email, mobile: row.mobile, metadata: row.metadata }
          : p,
      ),
    );
    toast.success("Participant updated");
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("participants").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId(null);
    toast.success("Participant removed");
  };

  const generateInvites = async (emails: string[]): Promise<InviteRow[]> => {
    if (!user) return [];
    const inputs: Array<{ owner_id: string; subtype_id: string; email: string | null }> =
      emails.length > 0
        ? emails.map((e) => ({ owner_id: user.id, subtype_id: subId, email: e }))
        : [{ owner_id: user.id, subtype_id: subId, email: null }];
    const { data, error } = await supabase
      .from("participant_invites")
      .insert(inputs)
      .select("id, email, token");
    if (error) { toast.error(error.message); throw error; }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return (data ?? []).map((r) => ({
      email: r.email,
      token: r.token,
      url: `${origin}/invite/${r.token}`,
    }));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((p) => {
      const haystack = [
        p.name, p.email, p.mobile,
        p.metadata.roll_number, p.metadata.seat_number,
        p.metadata.organization, p.metadata.class,
        p.metadata.address, p.metadata.notes,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [participants, search]);

  const selectedParticipant = selectedId ? participants.find((p) => p.id === selectedId) ?? null : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/participant-types" className="hover:text-foreground">All types</Link>
        <ChevronLeft className="h-3 w-3 rotate-180" />
        <Link to="/participant-types/$typeId" params={{ typeId }} className="hover:text-foreground">
          {type?.name ?? "Type"}
        </Link>
        <ChevronLeft className="h-3 w-3 rotate-180" />
        <span className="text-foreground">{sub?.name ?? "Sub-type"}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <UsersRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">{sub?.name ?? "Sub-type"}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Click any row to view that participant's quiz summary.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <UploadParticipantsDialog onSave={createMany} trigger={
            <Button variant="outline" className="gap-2"><Upload className="h-4 w-4" /> Upload File</Button>
          } />
          <ScanParticipantsDialog onSave={createMany} trigger={
            <Button variant="outline" className="gap-2"><ScanLine className="h-4 w-4" /> Scan Image</Button>
          } />
          <InviteDialog subtypeId={subId} subtypeName={sub?.name ?? "this group"} onGenerate={generateInvites} trigger={
            <Button variant="outline" className="gap-2"><Mail className="h-4 w-4" /> Invite Link</Button>
          } />
          <ParticipantDialog
            title="Add participant"
            description={`They'll be added under ${type?.name ?? "this type"} → ${sub?.name ?? "this sub-type"}.`}
            submitLabel="Add"
            onSubmit={create}
            trigger={
              <Button className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
                <UserPlus className="h-4 w-4" /> Add Manually
              </Button>
            }
          />
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, roll number…"
            className="pl-9"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {participants.length} {participants.length === 1 ? "participant" : "participants"}
        </span>
      </div>

      {/* Main content: table + stats panel side-by-side when a participant is selected */}
      <div className={`flex gap-4 items-start ${selectedParticipant ? "lg:flex-row flex-col" : ""}`}>
        {/* Table */}
        <div className={`min-w-0 ${selectedParticipant ? "lg:flex-1" : "w-full"}`}>
          {loading ? (
            <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
              Loading participants…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/60" />
              {participants.length === 0 ? (
                <>
                  <p className="mt-3 text-sm font-medium">No participants in this sub-type yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Add them manually or generate invite links.</p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm font-medium">No matches</p>
                  <p className="mt-1 text-xs text-muted-foreground">Try a different search.</p>
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
                    <TableHead className="hidden md:table-cell">Roll / Seat</TableHead>
                    <TableHead className="hidden lg:table-cell">Organization</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <ParticipantTableRow
                      key={p.id}
                      p={p}
                      selected={selectedId === p.id}
                      onSelect={() => setSelectedId((prev) => (prev === p.id ? null : p.id))}
                      onUpdate={update}
                      onDelete={remove}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Stats panel */}
        {selectedParticipant && (
          <div className="lg:w-80 w-full shrink-0">
            <ParticipantStatsPanel
              participant={selectedParticipant}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Stats panel ── */

function ParticipantStatsPanel({
  participant,
  onClose,
}: {
  participant: Participant;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<ParticipantStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setStats(null);

    (async () => {
      // Fetch all completed attempts for this participant, latest first
      const { data: attempts, error } = await supabase
        .from("quiz_attempts")
        .select(
          "id, session_id, score, total_questions, completed, completed_at, quiz_answers ( id, is_correct )",
        )
        .eq("participant_id", participant.id)
        .eq("completed", true)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });

      if (cancelled) return;
      if (error) { setLoading(false); return; }

      const rows = attempts ?? [];
      if (rows.length === 0) {
        setStats({
          totalAttempts: 0, completedAttempts: 0,
          totalCorrect: 0, totalWrong: 0, totalUnattempted: 0,
          avgScore: 0, highestScore: 0, lowestScore: 0,
          lastQuizAt: null, recentAttempts: [],
        });
        setLoading(false);
        return;
      }

      // Fetch session titles for the recent ones
      const sessionIds = Array.from(new Set(rows.map((r) => r.session_id)));
      const { data: sessions } = await supabase
        .from("quiz_sessions")
        .select("id, title")
        .in("id", sessionIds);
      if (cancelled) return;

      const titleById = new Map((sessions ?? []).map((s) => [s.id, s.title]));

      let totalCorrect = 0;
      let totalWrong = 0;
      let totalUnattempted = 0;
      const pctScores: number[] = [];

      for (const a of rows) {
        const answers = (a.quiz_answers ?? []) as { id: string; is_correct: boolean | null }[];
        const correct = answers.filter((x) => x.is_correct === true).length;
        const wrong = answers.filter((x) => x.is_correct === false).length;
        const unattempted = Math.max(0, a.total_questions - answers.length);
        totalCorrect += correct;
        totalWrong += wrong;
        totalUnattempted += unattempted;
        const pct = a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0;
        pctScores.push(pct);
      }

      const avgScore = pctScores.length > 0
        ? Math.round(pctScores.reduce((a, b) => a + b, 0) / pctScores.length)
        : 0;
      const highestScore = pctScores.length > 0 ? Math.max(...pctScores) : 0;
      const lowestScore = pctScores.length > 0 ? Math.min(...pctScores) : 0;

      const recentAttempts = rows.slice(0, 5).map((a) => {
        const pct = a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0;
        return {
          title: titleById.get(a.session_id) ?? "Unknown quiz",
          score: a.score,
          total: a.total_questions,
          pct,
          date: a.completed_at ? new Date(a.completed_at).toLocaleDateString() : "—",
        };
      });

      setStats({
        totalAttempts: rows.length,
        completedAttempts: rows.length,
        totalCorrect,
        totalWrong,
        totalUnattempted,
        avgScore,
        highestScore,
        lowestScore,
        lastQuizAt: rows[0]?.completed_at ?? null,
        recentAttempts,
      });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [participant.id]);

  const initials = participant.name.slice(0, 2).toUpperCase();

  return (
    <div className="rounded-2xl border border-primary/30 bg-card/70 shadow-glow overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-primary/5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{participant.name}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {participant.email || participant.mobile || "No contact info"}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors shrink-0"
        >
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
            <p className="text-xs text-muted-foreground mt-1">
              Stats appear once they complete a quiz.
            </p>
          </div>
        ) : (
          <>
            {/* Key stat grid */}
            <div className="grid grid-cols-2 gap-2">
              <StatTile
                icon={<Target className="h-3.5 w-3.5 text-primary" />}
                label="Quizzes"
                value={stats.totalAttempts}
              />
              <StatTile
                icon={<TrendingUp className="h-3.5 w-3.5 text-primary" />}
                label="Avg Score"
                value={`${stats.avgScore}%`}
                highlight
              />
              <StatTile
                icon={<CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                label="Correct"
                value={stats.totalCorrect}
                color="text-success"
              />
              <StatTile
                icon={<XCircle className="h-3.5 w-3.5 text-destructive" />}
                label="Wrong"
                value={stats.totalWrong}
                color="text-destructive"
              />
              <StatTile
                icon={<Trophy className="h-3.5 w-3.5 text-warning" />}
                label="Highest"
                value={`${stats.highestScore}%`}
                color="text-warning"
              />
              <StatTile
                icon={<Trophy className="h-3.5 w-3.5 text-muted-foreground" />}
                label="Lowest"
                value={`${stats.lowestScore}%`}
              />
            </div>

            {/* Unattempted */}
            {stats.totalUnattempted > 0 && (
              <div className="flex items-center justify-between text-xs rounded-lg bg-muted/30 px-3 py-2">
                <span className="text-muted-foreground">Questions skipped</span>
                <span className="font-semibold">{stats.totalUnattempted}</span>
              </div>
            )}

            {/* Last quiz */}
            {stats.lastQuizAt && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                Last quiz: {new Date(stats.lastQuizAt).toLocaleDateString(undefined, {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </div>
            )}

            {/* Avg score bar */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Average performance</span>
                <span className="font-semibold">{stats.avgScore}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    stats.avgScore >= 70
                      ? "bg-success"
                      : stats.avgScore >= 40
                        ? "bg-warning"
                        : "bg-destructive"
                  }`}
                  style={{ width: `${stats.avgScore}%` }}
                />
              </div>
            </div>

            {/* Recent quizzes */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Last {Math.min(stats.recentAttempts.length, 5)} Quizzes
              </div>
              <ul className="space-y-1.5">
                {stats.recentAttempts.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-lg bg-secondary/40 hover:bg-secondary/60 px-3 py-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{a.title}</div>
                      <div className="text-[10px] text-muted-foreground">{a.date}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`text-xs font-bold ${
                          a.pct >= 70
                            ? "text-success"
                            : a.pct >= 40
                              ? "text-warning"
                              : "text-destructive"
                        }`}
                      >
                        {a.score}/{a.total}
                      </div>
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

function StatTile({
  icon,
  label,
  value,
  color,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-3 py-2.5 ${
        highlight ? "bg-primary/10 border border-primary/20" : "bg-secondary/40"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span></div>
      <div className={`text-lg font-bold ${color ?? (highlight ? "text-primary" : "")}`}>{value}</div>
    </div>
  );
}

/* ── Table row ── */

function ParticipantTableRow({
  p,
  selected,
  onSelect,
  onUpdate,
  onDelete,
}: {
  p: Participant;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (id: string, d: ParticipantDraft) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <TableRow
      className={`cursor-pointer transition-colors ${
        selected ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/30"
      }`}
      onClick={onSelect}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          {selected ? (
            <ChevronUp className="h-3.5 w-3.5 text-primary shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <div>
            <div className={`font-medium ${selected ? "text-primary" : ""}`}>{p.name}</div>
            {p.metadata.class && (
              <div className="text-xs text-muted-foreground">{p.metadata.class}</div>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm space-y-0.5">
          {p.email && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Mail className="h-3 w-3" />
              <span className="truncate max-w-[200px]">{p.email}</span>
            </div>
          )}
          {p.mobile && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="h-3 w-3" />
              {p.mobile}
            </div>
          )}
          {!p.email && !p.mobile && <span className="text-xs text-muted-foreground">—</span>}
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="text-xs space-y-0.5">
          {p.metadata.roll_number && (
            <div className="flex items-center gap-1.5">
              <Hash className="h-3 w-3 text-muted-foreground" />
              {p.metadata.roll_number}
            </div>
          )}
          {p.metadata.seat_number && (
            <div className="flex items-center gap-1.5">
              <Armchair className="h-3 w-3 text-muted-foreground" />
              {p.metadata.seat_number}
            </div>
          )}
          {!p.metadata.roll_number && !p.metadata.seat_number && (
            <span className="text-muted-foreground">—</span>
          )}
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
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {p.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They'll be removed from your roster. Past attempts in completed sessions are kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              try { await onConfirm(p.id); setOpen(false); }
              finally { setBusy(false); }
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
