import { useEffect, useState, useMemo } from "react";
import { Search, Pencil, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { PaginationControls } from "@/components/PaginationControls";
import { TableShell, THead, SkeletonRows, SectionHead } from "./-shared";
import { statusBadge, fmtDateShort } from "./helpers";

type Row = {
  id: string;
  title: string;
  status: string;
  mode: string;
  topic: string | null;
  owner_name: string;
  owner_email: string;
  q_count: number;
  attempt_count: number;
  avg_score: number;
  created_at: string;
  started_at: string | null;
};

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function QuizzesSection() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ title: "", topic: "", status: "" });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const load = async () => {
    setLoading(true);
    const { data: sessions } = await supabase
      .from("quiz_sessions")
      .select("id,title,status,mode,topic,owner_id,created_at,started_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (!sessions?.length) { setLoading(false); return; }

    const ownerIds = [...new Set(sessions.map((s) => s.owner_id))];
    const sessIds = sessions.map((s) => s.id);

    const [{ data: owners }, { data: qLinks }, { data: attempts }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email").in("id", ownerIds),
      supabase.from("quiz_session_questions").select("session_id").in("session_id", sessIds),
      supabase
        .from("quiz_attempts")
        .select("session_id,score,total_questions,completed_at")
        .in("session_id", sessIds)
        .not("completed_at", "is", null),
    ]);

    const ownerMap: Record<string, { name: string; email: string }> = {};
    (owners ?? []).forEach((o) => { ownerMap[o.id] = { name: o.full_name ?? "-", email: o.email ?? "-" }; });
    const qMap: Record<string, number> = {};
    (qLinks ?? []).forEach((q) => { qMap[q.session_id] = (qMap[q.session_id] ?? 0) + 1; });
    const attMap: Record<string, { count: number; totalPct: number }> = {};
    (attempts ?? []).forEach((a) => {
      const pct = a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0;
      if (!attMap[a.session_id]) attMap[a.session_id] = { count: 0, totalPct: 0 };
      attMap[a.session_id].count++;
      attMap[a.session_id].totalPct += pct;
    });

    setRows(
      sessions.map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        mode: s.mode,
        topic: s.topic,
        owner_name: ownerMap[s.owner_id]?.name ?? "-",
        owner_email: ownerMap[s.owner_id]?.email ?? "-",
        q_count: qMap[s.id] ?? 0,
        attempt_count: attMap[s.id]?.count ?? 0,
        avg_score: attMap[s.id] ? Math.round(attMap[s.id].totalPct / attMap[s.id].count) : 0,
        created_at: s.created_at,
        started_at: s.started_at,
      })),
    );
    setLoading(false);
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let r = rows;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((x) => [x.title, x.owner_name, x.topic].some((v) => v?.toLowerCase().includes(q)));
    }
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    return r;
  }, [rows, search, statusFilter]);

  // react-doctor-disable-next-line react-doctor/no-derived-state-effect
  useEffect(() => { setPage(0); }, [search, statusFilter]);

  const paged = useMemo(() => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [filtered, page]);
  const toggleAll = () =>
    setSelected((prev) => prev.size === paged.length ? new Set() : new Set(paged.map((r) => r.id)));
  const allSelected = paged.length > 0 && selected.size === paged.length;

  const startEdit = (r: Row) => {
    setEditId(r.id);
    setEditData({ title: r.title, topic: r.topic ?? "", status: r.status });
  };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    const { error } = await supabase
      .from("quiz_sessions")
      .update({ title: editData.title, topic: editData.topic || null, status: editData.status })
      .eq("id", editId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Quiz updated");
    setEditId(null);
    void load();
  };

  const deleteQuiz = async (id: string) => {
    const { error } = await supabase.from("quiz_sessions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Quiz deleted");
    setConfirmDeleteId(null);
    void load();
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    const { error } = await supabase.from("quiz_sessions").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} quizzes deleted`);
    setSelected(new Set());
    setConfirmBulk(false);
    void load();
  };

  return (
    <div className="space-y-4">
      {confirmBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <p className="text-sm font-medium">Delete {selected.size} selected quizzes and all their attempts? This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirmBulk(false)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/40">Cancel</button>
              <button type="button" onClick={() => void bulkDelete()} className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90">Delete All</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <p className="text-sm font-medium">Delete this quiz session and all its attempts? This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/40">Cancel</button>
              <button type="button" onClick={() => void deleteQuiz(confirmDeleteId)} className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90">Delete</button>
            </div>
          </div>
        </div>
      )}

      <SectionHead title="Quiz Sessions" sub={`${rows.length} sessions created across all hosts.`} />
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30">
          <span className="text-sm font-medium text-destructive">{selected.size} selected</span>
          <button type="button" onClick={() => setConfirmBulk(true)} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90">
            <Trash2 className="size-3.5" /> Delete Selected
          </button>
          <button type="button" title="Clear selection" onClick={() => setSelected(new Set())} className="p-1 rounded-lg text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search title, host, type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36 h-11 sm:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["draft", "scheduled", "active", "completed", "expired"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TableShell footer={`${filtered.length} of ${rows.length} sessions`}>
        <thead>
          <tr className="border-b border-border/60 bg-muted/20">
            <th className="px-3 py-2.5 text-left">
              <input type="checkbox" title="Select all" checked={allSelected} onChange={toggleAll} className="rounded" />
            </th>
            {["Quiz Title","Host","Type","Status","Questions","Attempts","Avg Score","Created",""].map((c) => (
              <th key={c} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {loading ? (
            <SkeletonRows cols={10} />
          ) : paged.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-sm text-muted-foreground">No sessions found.</td>
            </tr>
          ) : (
            paged.map((r) =>
              editId === r.id ? (
                <tr key={r.id} className="bg-primary/5">
                  <td className="px-3 py-2"><input type="checkbox" title="Select" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" /></td>
                  <td className="px-4 py-2" colSpan={3}>
                    <div className="flex flex-col gap-1.5">
                      <input
                        title="Title"
                        placeholder="Quiz title"
                        value={editData.title}
                        onChange={(e) => setEditData((d) => ({ ...d, title: e.target.value }))}
                        className="w-full h-8 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <input
                        title="Topic"
                        placeholder="Topic (optional)"
                        value={editData.topic}
                        onChange={(e) => setEditData((d) => ({ ...d, topic: e.target.value }))}
                        className="w-full h-8 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      title="Status"
                      value={editData.status}
                      onChange={(e) => setEditData((d) => ({ ...d, status: e.target.value }))}
                      className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      {["draft", "scheduled", "active", "completed", "expired"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td colSpan={4} />
                  <td className="px-4 py-2">
                    <div className="flex gap-1.5">
                      <button type="button" onClick={saveEdit} disabled={saving} title="Save" className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                        <Save className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => setEditId(null)} title="Cancel" className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted/40">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-3 py-3"><input type="checkbox" title="Select" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" /></td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium max-w-[180px] truncate">{r.title}</div>
                    <div className="text-[11px] text-muted-foreground capitalize">{r.mode.replace("_", " ")}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium">{r.owner_name}</div>
                    <div className="text-[11px] text-muted-foreground">{r.owner_email}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.topic ?? "-"}</td>
                  <td className="px-4 py-3">{statusBadge(r.status)}</td>
                  <td className="px-4 py-3 text-xs font-medium text-center">{r.q_count}</td>
                  <td className="px-4 py-3 text-xs font-medium text-center">{r.attempt_count}</td>
                  <td className="px-4 py-3">
                    {r.attempt_count > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <Progress value={r.avg_score} className="h-1.5 w-12" />
                        <span className={`text-xs font-semibold ${r.avg_score >= 70 ? "text-success" : r.avg_score >= 40 ? "text-warning" : "text-destructive"}`}>
                          {r.avg_score}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDateShort(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => startEdit(r)} title="Edit" className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                        <Pencil className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => setConfirmDeleteId(r.id)} title="Delete" className="p-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )
          )}
        </tbody>
      </TableShell>
      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={filtered.length}
        label="sessions"
        onPageChange={setPage}
      />
    </div>
  );
}
