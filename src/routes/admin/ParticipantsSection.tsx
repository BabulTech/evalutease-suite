import { useEffect, useCallback } from "react";
import { useState } from "react";
import { Search } from "lucide-react";
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

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function ParticipantsSection() {
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
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<"created_at" | "name">("created_at");
  const { page, pageSize, setPage, setPageSize } = usePaginationState(25);
  const debouncedSearch = useDebouncedValue(search, 250);

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
    (owners ?? []).forEach((o) => {
      ownerMap[o.id] = o.full_name ?? "-";
    });
    const subMap: Record<string, string> = {};
    (subtypes ?? []).forEach((s) => {
      subMap[s.id] = s.name;
    });

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

  useEffect(() => {
    void loadParticipants();
  }, [loadParticipants]);

  return (
    <div className="space-y-4">
      <SectionHead title="Participants" sub={`${total} participants across all hosts.`} />
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
        <THead cols={["Participant", "Host", "Group", "Quizzes Taken", "Avg Score", "Added"]} />
        <tbody className="divide-y divide-border/40">
          {loading ? (
            <SkeletonRows cols={6} />
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No participants found.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3">
                  <div className="text-xs font-medium">{r.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.email ?? r.mobile ?? "-"}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.owner_name}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.subtype}</td>
                <td className="px-4 py-3 text-xs font-medium text-center">{r.attempt_count}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Progress value={r.avg_score} className="h-1.5 w-16" />
                    <span
                      className={`text-xs font-semibold ${r.avg_score >= 70 ? "text-success" : r.avg_score >= 40 ? "text-warning" : "text-destructive"}`}
                    >
                      {r.attempt_count > 0 ? `${r.avg_score}%` : "-"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {fmtDateShort(r.created_at)}
                </td>
              </tr>
            ))
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
