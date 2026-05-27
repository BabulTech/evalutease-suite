import { useEffect, useState, useMemo } from "react";
import { Search, Pencil, Trash2, Save, X, Filter } from "lucide-react";
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
import { TableShell, SkeletonRows, SectionHead } from "./-shared";
import { fmtDateShort } from "./helpers";

type Row = {
  id: string;
  name: string;
  subject: string | null;
  icon: string | null;
  owner_name: string;
  sub_count: number;
  question_count: number;
  created_at: string;
};

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function CategoriesSection() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");

  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: "", subject: "", icon: "" });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: cats } = await supabase
      .from("question_categories")
      .select("id,name,subject,icon,owner_id,created_at")
      .order("created_at", { ascending: false });
    if (!cats?.length) { setLoading(false); return; }

    const ownerIds = [...new Set(cats.map((c) => c.owner_id))];
    const catIds = cats.map((c) => c.id);

    const [{ data: owners }, { data: subs }, { data: qs }] = await Promise.all([
      supabase.from("profiles").select("id,full_name").in("id", ownerIds),
      supabase.from("question_subcategories").select("category_id").in("category_id", catIds),
      supabase.from("questions").select("category_id").in("category_id", catIds),
    ]);

    const ownerMap: Record<string, string> = {};
    (owners ?? []).forEach((o) => { ownerMap[o.id] = o.full_name ?? "-"; });
    const subCnt: Record<string, number> = {};
    (subs ?? []).forEach((s) => { subCnt[s.category_id] = (subCnt[s.category_id] ?? 0) + 1; });
    const qCnt: Record<string, number> = {};
    (qs ?? []).forEach((q) => { if (q.category_id) qCnt[q.category_id] = (qCnt[q.category_id] ?? 0) + 1; });

    setRows(
      cats.map((c) => ({
        id: c.id,
        name: c.name,
        subject: c.subject,
        icon: c.icon,
        owner_name: ownerMap[c.owner_id] ?? "-",
        sub_count: subCnt[c.id] ?? 0,
        question_count: qCnt[c.id] ?? 0,
        created_at: c.created_at,
      })),
    );
    setLoading(false);
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const subjects = useMemo(() => [...new Set(rows.map((r) => r.subject).filter(Boolean))] as string[], [rows]);
  const owners = useMemo(() => [...new Set(rows.map((r) => r.owner_name))].sort(), [rows]);

  const filtered = useMemo(() => {
    let r = rows;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((x) => [x.name, x.subject, x.owner_name].some((v) => v?.toLowerCase().includes(q)));
    }
    if (subjectFilter !== "all") r = r.filter((x) => x.subject === subjectFilter);
    if (ownerFilter !== "all") r = r.filter((x) => x.owner_name === ownerFilter);
    return r;
  }, [rows, search, subjectFilter, ownerFilter]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () =>
    setSelected((prev) => prev.size === filtered.length ? new Set() : new Set(filtered.map((r) => r.id)));
  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  const startEdit = (r: Row) => {
    setEditId(r.id);
    setEditData({ name: r.name, subject: r.subject ?? "", icon: r.icon ?? "" });
  };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    const { error } = await supabase
      .from("question_categories")
      .update({ name: editData.name, subject: editData.subject || null, icon: editData.icon || null })
      .eq("id", editId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Category updated");
    setEditId(null);
    void load();
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from("question_categories").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Category deleted");
    setConfirmDeleteId(null);
    void load();
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    const { error } = await supabase.from("question_categories").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} categories deleted`);
    setSelected(new Set());
    setConfirmBulk(false);
    void load();
  };

  return (
    <div className="space-y-4">
      {confirmBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4">
            <p className="text-sm font-medium">Delete {selected.size} selected categories and all their questions? This cannot be undone.</p>
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
            <p className="text-sm font-medium">Delete this category and all its questions? This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/40">Cancel</button>
              <button type="button" onClick={() => void deleteCategory(confirmDeleteId)} className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90">Delete</button>
            </div>
          </div>
        </div>
      )}

      <SectionHead title="Question Categories" sub={`${rows.length} categories created by hosts.`} />

      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30">
          <span className="text-sm font-medium text-destructive">{selected.size} selected</span>
          <button type="button" onClick={() => setConfirmBulk(true)} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90">
            <Trash2 className="size-3.5" /> Delete Selected
          </button>
          <button type="button" title="Clear selection" onClick={() => setSelected(new Set())} className="p-1 rounded-lg text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-3">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search name, subject, host…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-full sm:w-44 h-11 sm:h-9">
            <Filter className="size-4 mr-1" />
            <SelectValue placeholder="All subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ownerFilter} onValueChange={setOwnerFilter}>
          <SelectTrigger className="w-full sm:w-44 h-11 sm:h-9">
            <Filter className="size-4 mr-1" />
            <SelectValue placeholder="All owners" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {owners.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TableShell footer={`${filtered.length} of ${rows.length} categories`}>
        <thead>
          <tr className="border-b border-border/60 bg-muted/20">
            <th className="px-3 py-2.5 text-left">
              <input type="checkbox" title="Select all" checked={allSelected} onChange={toggleAll} className="rounded" />
            </th>
            {["Category", "Subject", "Owner", "Subcategories", "Questions", "Created", ""].map((c) => (
              <th key={c} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {loading ? (
            <SkeletonRows cols={8} />
          ) : filtered.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No categories found.</td>
            </tr>
          ) : (
            filtered.map((r) =>
              editId === r.id ? (
                <tr key={r.id} className="bg-primary/5">
                  <td className="px-3 py-2"><input type="checkbox" title="Select" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" /></td>
                  <td className="px-4 py-2" colSpan={3}>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex gap-2">
                        <input
                          title="Icon"
                          placeholder="Icon (emoji)"
                          value={editData.icon}
                          onChange={(e) => setEditData((d) => ({ ...d, icon: e.target.value }))}
                          className="w-16 h-8 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                        <input
                          title="Name"
                          placeholder="Category name"
                          value={editData.name}
                          onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))}
                          className="flex-1 h-8 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                      <input
                        title="Subject"
                        placeholder="Subject (optional)"
                        value={editData.subject}
                        onChange={(e) => setEditData((d) => ({ ...d, subject: e.target.value }))}
                        className="w-full h-8 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                  </td>
                  <td colSpan={3} />
                  <td className="px-4 py-2">
                    <div className="flex gap-1.5">
                      <button type="button" onClick={saveEdit} disabled={saving} title="Save" className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"><Save className="size-3.5" /></button>
                      <button type="button" onClick={() => setEditId(null)} title="Cancel" className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted/40"><X className="size-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-3 py-3"><input type="checkbox" title="Select" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{r.icon ?? "📁"}</span>
                      <span className="text-xs font-medium">{r.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.subject ?? "-"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{r.owner_name}</td>
                  <td className="px-4 py-3 text-xs font-medium text-center">{r.sub_count}</td>
                  <td className="px-4 py-3 text-xs font-medium text-center">{r.question_count}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDateShort(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => startEdit(r)} title="Edit" className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"><Pencil className="size-3.5" /></button>
                      <button type="button" onClick={() => setConfirmDeleteId(r.id)} title="Delete" className="p-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="size-3.5" /></button>
                    </div>
                  </td>
                </tr>
              )
            )
          )}
        </tbody>
      </TableShell>
    </div>
  );
}
