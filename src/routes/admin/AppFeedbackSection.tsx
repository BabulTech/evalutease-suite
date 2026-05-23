import React, { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Bug, Lightbulb, TrendingUp, HelpCircle, Eye, Reply } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaginationControls } from "@/components/PaginationControls";
import { TableShell, THead, SkeletonRows, SectionHead } from "./-shared";
import { statusBadge, fmtDate, fmtDateShort } from "./helpers";

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function AppFeedbackSection({ onCountChange }: { onCountChange: (n: number) => void }) {
  type Row = {
    id: string;
    user_name: string;
    user_email: string;
    type: string;
    title: string;
    body: string;
    status: string;
    priority: string;
    admin_reply: string | null;
    created_at: string;
  };
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Row | null>(null);
  const [replyText, setReplyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("app_feedback")
      .select("id,user_id,type,title,body,status,priority,admin_reply,created_at")
      .order("created_at", { ascending: false });
    if (!data?.length) {
      setLoading(false);
      return;
    }

    const userIds = [...new Set(data.map((d) => d.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,full_name,email")
      .in("id", userIds);
    const profMap: Record<string, { name: string; email: string }> = {};
    (profiles ?? []).forEach((p) => {
      profMap[p.id] = { name: p.full_name ?? "-", email: p.email ?? "-" };
    });

    const enriched = data.map((d) => ({
      id: d.id,
      user_name: profMap[d.user_id]?.name ?? "-",
      user_email: profMap[d.user_id]?.email ?? "-",
      type: d.type,
      title: d.title,
      body: d.body,
      status: d.status,
      priority: d.priority,
      admin_reply: d.admin_reply,
      created_at: d.created_at,
    }));
    setRows(enriched);
    onCountChange(enriched.filter((r) => r.status === "open").length);
    setLoading(false);
  }, [onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("app_feedback").update({ status }).eq("id", id);
    void load();
    if (detail?.id === id) setDetail((d) => (d ? { ...d, status } : null));
  };

  const submitReply = async () => {
    if (!detail || !replyText.trim()) return;
    setSaving(true);
    await supabase
      .from("app_feedback")
      .update({ admin_reply: replyText.trim(), status: "in_review" })
      .eq("id", detail.id);
    setSaving(false);
    toast.success("Reply sent");
    setReplyText("");
    void load();
    setDetail(null);
  };

  const filtered = useMemo(() => {
    let r = rows;
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    if (typeFilter !== "all") r = r.filter((x) => x.type === typeFilter);
    return r;
  }, [rows, statusFilter, typeFilter]);

  // react-doctor-disable-next-line react-doctor/no-derived-state-effect
  // react-doctor-disable-next-line react-doctor/no-chain-state-updates
  useEffect(() => {
    setPage(0);
  }, [statusFilter, typeFilter]);
  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );

  const typeIcon: Record<string, React.ElementType> = {
    bug: Bug,
    feature: Lightbulb,
    improvement: TrendingUp,
    other: HelpCircle,
  };
  const priorityCls: Record<string, string> = {
    critical: "bg-destructive/15 text-destructive",
    high: "bg-warning/15 text-warning",
    medium: "bg-primary/15 text-primary",
    low: "bg-muted/40 text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      <SectionHead
        title="App Feedback"
        sub="Suggestions, bugs, and feature requests from teachers."
      />

      <div className="flex flex-wrap gap-2">
        {[
          { label: "Open", status: "open", cls: "bg-primary/15 text-primary" },
          { label: "In Review", status: "in_review", cls: "bg-warning/15 text-warning" },
          { label: "Resolved", status: "resolved", cls: "bg-success/15 text-success" },
        ].map(({ label, status, cls }) => {
          const cnt = rows.filter((r) => r.status === status).length;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
              className={`min-h-10 rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all ${statusFilter === status ? cls + " border-transparent" : "border-border text-muted-foreground hover:border-primary/30"}`}
            >
              {label} <span className="ml-1 font-bold">{cnt}</span>
            </button>
          );
        })}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 h-10 sm:h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="feature">Feature</SelectItem>
            <SelectItem value="improvement">Improvement</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TableShell footer={`${filtered.length} of ${rows.length} submissions`}>
        <THead cols={["Teacher", "Type", "Title", "Priority", "Status", "Date", ""]} />
        <tbody className="divide-y divide-border/40">
          {loading ? (
            <SkeletonRows cols={7} />
          ) : paged.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No feedback yet.
              </td>
            </tr>
          ) : (
            paged.map((r) => {
              const TypeIcon = typeIcon[r.type] ?? HelpCircle;
              return (
                <tr
                  key={r.id}
                  className="hover:bg-muted/10 transition-colors cursor-pointer"
                  onClick={() => {
                    setDetail(r);
                    setReplyText(r.admin_reply ?? "");
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium">{r.user_name}</div>
                    <div className="text-[11px] text-muted-foreground">{r.user_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground capitalize">
                      <TypeIcon className="size-3.5" /> {r.type}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-medium max-w-[200px] truncate">
                    {r.title}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={`${priorityCls[r.priority] ?? ""} border-0 text-[10px] capitalize`}
                    >
                      {r.priority}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{statusBadge(r.status)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDateShort(r.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Eye className="size-4 text-muted-foreground" />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </TableShell>
      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={filtered.length}
        label="submissions"
        onPageChange={setPage}
      />

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail &&
                (() => {
                  const I = typeIcon[detail.type] ?? HelpCircle;
                  return <I className="size-4" />;
                })()}
              {detail?.title}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {statusBadge(detail.status)}
                <Badge
                  className={`${priorityCls[detail.priority] ?? ""} border-0 text-[10px] capitalize`}
                >
                  {detail.priority} priority
                </Badge>
                <span className="text-xs text-muted-foreground">
                  from {detail.user_name} · {fmtDate(detail.created_at)}
                </span>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {detail.body}
              </div>
              {detail.admin_reply && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <div className="text-[10px] text-primary font-semibold uppercase tracking-wider mb-1">
                    Admin Reply
                  </div>
                  <p className="text-xs text-foreground whitespace-pre-wrap">
                    {detail.admin_reply}
                  </p>
                </div>
              )}
              <div>
                <div className="text-xs font-medium mb-1.5">Reply to teacher</div>
                <Textarea
                  rows={3}
                  placeholder="Type your reply…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="resize-none text-xs"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => void submitReply()}
                  disabled={saving || !replyText.trim()}
                  className="bg-gradient-primary text-primary-foreground shadow-glow gap-1.5"
                >
                  <Reply className="size-3.5" />
                  {saving ? "Sending…" : "Send Reply"}
                </Button>
                {["open", "in_review", "resolved", "wont_fix"].map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    className={detail.status === s ? "border-primary text-primary" : ""}
                    onClick={() => void updateStatus(detail.id, s)}
                  >
                    {s.replace("_", " ")}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
