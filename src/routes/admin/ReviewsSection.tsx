import { useEffect, useState, useMemo } from "react";
import { Search, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableShell, THead, SkeletonRows, SectionHead } from "./-shared";
import { fmtDateShort } from "./helpers";

export function ReviewsSection() {
  type Row = {
    id: string;
    session_title: string;
    host_name: string;
    host_email: string;
    participant_name: string;
    participant_email: string | null;
    rating: number;
    comment: string | null;
    submitted_at: string;
  };
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: feedback } = await supabase
        .from("quiz_feedback")
        .select("id,session_id,participant_name,participant_email,rating,comment,submitted_at")
        .order("submitted_at", { ascending: false })
        .limit(300);
      if (!feedback?.length) {
        setLoading(false);
        return;
      }

      const sessIds = [...new Set(feedback.map((f) => f.session_id))];
      const { data: sessions } = await supabase
        .from("quiz_sessions")
        .select("id,title,owner_id")
        .in("id", sessIds);
      const ownerIds = [...new Set((sessions ?? []).map((s) => s.owner_id))];
      const { data: owners } = await supabase
        .from("profiles")
        .select("id,full_name,email")
        .in("id", ownerIds);

      const sessMap: Record<string, { title: string; owner_id: string }> = {};
      (sessions ?? []).forEach((s) => {
        sessMap[s.id] = { title: s.title, owner_id: s.owner_id };
      });
      const ownerMap: Record<string, { name: string; email: string }> = {};
      (owners ?? []).forEach((o) => {
        ownerMap[o.id] = { name: o.full_name ?? "-", email: o.email ?? "-" };
      });

      setRows(
        feedback.map((f) => {
          const sess = sessMap[f.session_id];
          const owner = sess
            ? (ownerMap[sess.owner_id] ?? { name: "-", email: "-" })
            : { name: "-", email: "-" };
          return {
            id: f.id,
            session_title: sess?.title ?? "-",
            host_name: owner.name,
            host_email: owner.email,
            participant_name: f.participant_name,
            participant_email: f.participant_email,
            rating: f.rating,
            comment: f.comment,
            submitted_at: f.submitted_at,
          };
        }),
      );
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let r = rows;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((x) =>
        [x.session_title, x.host_name, x.participant_name, x.comment].some((v) =>
          v?.toLowerCase().includes(q),
        ),
      );
    }
    if (ratingFilter !== "all") r = r.filter((x) => String(x.rating) === ratingFilter);
    return r;
  }, [rows, search, ratingFilter]);

  const avg = rows.length ? (rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(1) : "-";
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, cnt: rows.filter((r) => r.rating === n).length }));

  return (
    <div className="space-y-4">
      <SectionHead
        title="Student Reviews"
        sub="Feedback submitted by participants after completing quizzes."
      />

      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-card/60 p-5 flex items-center gap-5">
            <div className="text-center">
              <div className="font-display text-5xl font-bold text-warning">{avg}</div>
              <div className="flex gap-0.5 mt-1 justify-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3.5 w-3.5 ${i < Math.round(Number(avg)) ? "text-warning fill-warning" : "text-muted-foreground"}`}
                  />
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{rows.length} reviews</div>
            </div>
            <div className="flex-1 space-y-1">
              {dist.map(({ n, cnt }) => (
                <div key={n} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-muted-foreground text-right">{n}</span>
                  <div className="flex-1 rounded-full bg-muted/30 h-1.5">
                    <div
                      className="h-full rounded-full bg-warning"
                      style={{ width: rows.length ? `${(cnt / rows.length) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="text-muted-foreground w-5 text-right">{cnt}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-2">
            <div className="text-sm font-semibold mb-3">Top Hosts by Reviews</div>
            {Object.entries(
              rows.reduce(
                (acc, r) => {
                  acc[r.host_name] = (acc[r.host_name] ?? 0) + 1;
                  return acc;
                },
                {} as Record<string, number>,
              ),
            )
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([name, cnt]) => (
                <div key={name} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate text-muted-foreground">{name}</span>
                  <span className="font-semibold">{cnt}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search quiz, host, participant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-full sm:w-32 h-11 sm:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ratings</SelectItem>
            {[5, 4, 3, 2, 1].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {"★".repeat(n)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TableShell footer={`${filtered.length} of ${rows.length} reviews`}>
        <THead cols={["Quiz / Host", "Participant", "Rating", "Comment", "Date"]} />
        <tbody className="divide-y divide-border/40">
          {loading ? (
            <SkeletonRows cols={5} />
          ) : filtered.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No reviews yet.
              </td>
            </tr>
          ) : (
            filtered.map((r) => (
              <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3">
                  <div className="text-xs font-medium max-w-[160px] truncate">
                    {r.session_title}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{r.host_name}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs font-medium">{r.participant_name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.participant_email ?? "-"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${i < r.rating ? "text-warning fill-warning" : "text-muted-foreground/30"}`}
                      />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px]">
                  {r.comment ? (
                    <span className="line-clamp-2">{r.comment}</span>
                  ) : (
                    <span className="italic">No comment</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {fmtDateShort(r.submitted_at)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>
    </div>
  );
}
