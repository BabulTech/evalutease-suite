import { useEffect, useState, useMemo } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { TableShell, THead, SkeletonRows, SectionHead } from "./-shared";
import { fmtDateShort } from "./helpers";

export function CategoriesSection() {
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
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: cats } = await supabase
        .from("question_categories")
        .select("id,name,subject,icon,owner_id,created_at")
        .order("created_at", { ascending: false });
      if (!cats?.length) {
        setLoading(false);
        return;
      }

      const ownerIds = [...new Set(cats.map((c) => c.owner_id))];
      const catIds = cats.map((c) => c.id);

      const [{ data: owners }, { data: subs }, { data: qs }] = await Promise.all([
        supabase.from("profiles").select("id,full_name").in("id", ownerIds),
        supabase.from("question_subcategories").select("category_id").in("category_id", catIds),
        supabase.from("questions").select("category_id").in("category_id", catIds),
      ]);

      const ownerMap: Record<string, string> = {};
      (owners ?? []).forEach((o) => {
        ownerMap[o.id] = o.full_name ?? "-";
      });
      const subCnt: Record<string, number> = {};
      (subs ?? []).forEach((s) => {
        subCnt[s.category_id] = (subCnt[s.category_id] ?? 0) + 1;
      });
      const qCnt: Record<string, number> = {};
      (qs ?? []).forEach((q) => {
        if (q.category_id) qCnt[q.category_id] = (qCnt[q.category_id] ?? 0) + 1;
      });

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
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      [r.name, r.subject, r.owner_name].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <SectionHead
        title="Question Categories"
        sub={`${rows.length} categories created by hosts.`}
      />
      <div className="relative max-w-sm sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search name, subject, host…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <TableShell footer={`${filtered.length} of ${rows.length} categories`}>
        <THead cols={["Category", "Subject", "Owner", "Subcategories", "Questions", "Created"]} />
        <tbody className="divide-y divide-border/40">
          {loading ? (
            <SkeletonRows cols={6} />
          ) : filtered.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No categories found.
              </td>
            </tr>
          ) : (
            filtered.map((r) => (
              <tr key={r.id} className="hover:bg-muted/10 transition-colors">
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
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {fmtDateShort(r.created_at)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>
    </div>
  );
}
