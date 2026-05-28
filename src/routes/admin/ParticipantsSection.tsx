import { useEffect, useCallback, useState } from "react";
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
import { usePaginationState } from "@/hooks/use-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { TableShell, THead, SkeletonRows, SectionHead } from "./-shared";
import { fmtDateShort } from "./helpers";

type Row = {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  owner_name: string;
  subtype: string;
  created_at: string;
  attempt_count: number;
  avg_score: number;
};

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function ParticipantsSection() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<"created_at" | "name">("created_at");
  const { page, pageSize, setPage, setPageSize } = usePaginationState(25);
  const debouncedSearch = useDebouncedValue(search, 250);

  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: "", email: "", mobile: "" });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () =>
    setSelected((prev) => prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)));
  const allSelected = rows.length > 0 && selected.size === rows.length;

  const loadParticipants = useCallback(async () => {
    setLoading(true);
    const offset = page * pageSize;
    const searchTerm = debouncedSearch.trim();
    let query = supabase
      .from("participants")
      .select("id,name,email,mobile,owner_id,subtype_id,created_at", { count: "exact" });
    if (searchTerm) {
      query = query.or(
        `name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,mobile.ilike.%${searchTerm}%`,
      );
    }
    query =
      sort === "name"
        ? query.order("name", { ascending: true })
        : query.order("created_at", { ascending: false });

    const { data: parts, count } = await query.range(offset, offset + pageSize - 1);
    setTotal(count ?? 0);
    if (!parts?.length) {
      setRows([]);
      setLoading(false);
      return;
    }

    const ownerIds = [...new Set(parts.map((p) => p.owner_id))];
    const subtypeIds = [...new Set(parts.flatMap((p) => (p.subtype_id ? [p.subtype_id] : [])))];
    const partIds = parts.map((p) => p.id);

    const [{ data: owners }, { data: subtypes }, { data: attempts }] = await Promise.all([
      supabase.from("profiles").select("id,full_name").in("id", ownerIds),
      subtypeIds.length
        ? supabase.from("participant_subtypes").select("id,name").in("id", subtypeIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("quiz_attempts")
        .select("participant_id,score,total_questions,completed_at")
        .in("participant_id", partIds)
        .not("completed_at", "is", null),
    ]);

    const ownerMap: Record<string, string> = {};
    (owners ?? []).forEach((o) => { ownerMap[o.id] = o.full_name ?? "-"; });
    const subMap: Record<string, string> = {};
    (subtypes ?? []).forEach((s) => { subMap[s.id] = s.name; });

    const attemptMap: Record<string, { count: number; totalPct: number }> = {};
    (attempts ?? []).forEach((a) => {
      if (!a.participant_id) return;
      const pct = a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0;
      if (!attemptMap[a.participant_id]) attemptMap[a.participant_id] = { count: 0, totalPct: 0 };
      attemptMap[a.participant_id].count++;
      attemptMap[a.participant_id].totalPct += pct;
    });

    setRows(
      parts.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        mobile: p.mobile,
        owner_name: ownerMap[p.owner_id] ?? "-",
        subtype: p.subtype_id ? (subMap[p.subtype_id] ?? "-") : "-",
        created_at: p.created_at,
        attempt_count: attemptMap[p.id]?.count ?? 0,
        avg_score: attemptMap[p.id]
          ? Math.round(attemptMap[p.id].totalPct / attemptMap[p.id].count)
          : 0,
      })),
    );
    setLoading(false);
  }, [debouncedSearch, page, pageSize, sort]);

  useEffect(() => { void loadParticipants(); }, [loadParticipants]);

  const startEdit = (r: Row) => {
    setEditId(r.id);
    setEditData({ name: r.name, email: r.email ?? "", mobile: r.mobile ?? "" });
  };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    const { error } = await supabase
      .from("participants")
      .update({ name: editData.name, email: editData.email || null, mobile: editData.mobile || null })
      .eq("id", editId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Participant updated");
    setEditId(null);
    void loadParticipants();
  };

  const deleteParticipant = async (id: string) => {
    const { error } = await supabase.from("participants").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Participant deleted");
    setConfirmDeleteId(null);
    void loadParticipants();
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    const { error } = await supabase.from("participants").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} participants deleted`);
    setSelected(new Set());
    setConfirmBulk(false);
    void loadParticipants();
  };

  return (
    <div className="space-y-4">
      {confirmBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <p className="text-sm font-medium">Delete {selected.size} selected participants and all their attempts? This cannot be undone.</p>
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
            <p className="text-sm font-medium">Delete this participant and all their quiz attempts? This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/40">Cancel</button>
              <button type="button" onClick={() => void deleteParticipant(confirmDeleteId)} className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90">Delete</button>
            </div>
          </div>
        </div>
      )}

      <SectionHead title="Participants" aria-label="Participants" sub={`${total} participants across all hosts.`} />
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30">
          <span className="text-sm font-medium text-destructive">{selected.size} selected</span>
          <button type="button" onClick={() => setConfirmBulk(true)} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90">
            <Trash2 className="size-3.5" /> Delete Selected
          </button>
          <button type="button" title="Clear selection" aria-label="Clear selection" onClick={() => setSelected(new Set())} className="p-1 rounded-lg text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, mobile…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 sm:h-9"
          />
        </div>
        <Select value={sort} onValueChange={(value) => setSort(value as "created_at" | "name")}>
          <SelectTrigger className="w-full sm:w-40 h-11 sm:h-9">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Newest added</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TableShell>
        <thead>
          <tr className="border-b border-border/60 bg-muted/20">
            <th className="px-3 py-2.5 text-left">
              <input type="checkbox" title="Select all" aria-label="Select all" checked={allSelected} onChange={toggleAll} className="rounded" />
            </th>
            {["Participant","Host","Group","Quizzes Taken","Avg Score","Added",""].map((c) => (
              <th key={c} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {loading ? (
            <SkeletonRows cols={8} />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No participants found.
              </td>
            </tr>
          ) : (
            rows.map((r) =>
              editId === r.id ? (
                <tr key={r.id} className="bg-primary/5">
                  <td className="px-3 py-2"><input type="checkbox" title="Select" aria-label="Select" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" /></td>
                  <td className="px-4 py-2" colSpan={2}>
                    <div className="flex flex-col gap-1.5">
                      <input
                        title="Name" aria-label="Name"
                        placeholder="Name"
                        value={editData.name}
                        onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))}
                        className="w-full h-8 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <input
                        
                        title="Email" aria-label="Email"
                        placeholder="Email"
                        value={editData.email}
                        onChange={(e) => setEditData((d) => ({ ...d, email: e.target.value }))}
                        className="w-full h-8 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <input
                        
                        title="Mobile" aria-label="Mobile"
                        placeholder="Mobile"
                        value={editData.mobile}
                        onChange={(e) => setEditData((d) => ({ ...d, mobile: e.target.value }))}
                        className="w-full h-8 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </td>
                  <td colSpan={4} />
                  <td className="px-4 py-2">
                    <div className="flex gap-1.5">
                      <button type="button" onClick={saveEdit} disabled={saving} title="Save" aria-label="Save" className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                        <Save className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => setEditId(null)} title="Cancel" aria-label="Cancel" className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted/40">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                  <td className="p-3"><input type="checkbox" title="Select" aria-label="Select" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" /></td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium">{r.name}</div>
                    <div className="text-[11px] text-muted-foreground">{r.email ?? r.mobile ?? "-"}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.owner_name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.subtype}</td>
                  <td className="px-4 py-3 text-xs font-medium text-center">{r.attempt_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Progress value={r.avg_score} className="h-1.5 w-16" />
                      <span className={`text-xs font-semibold ${r.avg_score >= 70 ? "text-success" : r.avg_score >= 40 ? "text-warning" : "text-destructive"}`}>
                        {r.attempt_count > 0 ? `${r.avg_score}%` : "-"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDateShort(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => startEdit(r)} title="Edit" aria-label="Edit" className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                        <Pencil className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => setConfirmDeleteId(r.id)} title="Delete" aria-label="Delete" className="p-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors">
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
        pageSize={pageSize}
        total={total}
        label="participants"
        onPageChange={setPage}
        pageSizeOptions={[25, 50, 100]}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
