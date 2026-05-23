import { useEffect, useState, useMemo } from "react";
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
import { TableShell, THead, SkeletonRows, SectionHead } from "./-shared";
import { statusBadge, fmtDateShort } from "./helpers";

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function QuizzesSection() {
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
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: sessions } = await supabase
        .from("quiz_sessions")
        .select("id,title,status,mode,topic,owner_id,created_at,started_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (!sessions?.length) {
        setLoading(false);
        return;
      }

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
      (owners ?? []).forEach((o) => {
        ownerMap[o.id] = { name: o.full_name ?? "-", email: o.email ?? "-" };
      });
      const qMap: Record<string, number> = {};
      (qLinks ?? []).forEach((q) => {
        qMap[q.session_id] = (qMap[q.session_id] ?? 0) + 1;
      });
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
    })();
  }, []);

  const filtered = useMemo(() => {
    let r = rows;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((x) =>
        [x.title, x.owner_name, x.topic].some((v) => v?.toLowerCase().includes(q)),
      );
    }
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    return r;
  }, [rows, search, statusFilter]);

  // react-doctor-disable-next-line react-doctor/no-derived-state-effect
  // react-doctor-disable-next-line react-doctor/no-chain-state-updates
  useEffect(() => {
    setPage(0);
  }, [search, statusFilter]);
  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );

  return (
    <div className="space-y-4">
      <SectionHead
        title="Quiz Sessions"
        sub={`${rows.length} sessions created across all hosts.`}
      />
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
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <TableShell footer={`${filtered.length} of ${rows.length} sessions`}>
        <THead
          cols={[
            "Quiz Title",
            "Host",
            "Type",
            "Status",
            "Questions",
            "Attempts",
            "Avg Score",
            "Created",
          ]}
        />
        <tbody className="divide-y divide-border/40">
          {loading ? (
            <SkeletonRows cols={8} />
          ) : paged.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No sessions found.
              </td>
            </tr>
          ) : (
            paged.map((r) => (
              <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3">
                  <div className="text-xs font-medium max-w-[180px] truncate">{r.title}</div>
                  <div className="text-[11px] text-muted-foreground capitalize">
                    {r.mode.replace("_", " ")}
                  </div>
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
                      <span
                        className={`text-xs font-semibold ${r.avg_score >= 70 ? "text-success" : r.avg_score >= 40 ? "text-warning" : "text-destructive"}`}
                      >
                        {r.avg_score}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
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
        pageSize={PAGE_SIZE}
        total={filtered.length}
        label="sessions"
        onPageChange={setPage}
      />
    </div>
  );
}
