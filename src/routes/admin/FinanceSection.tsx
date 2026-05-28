import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Filter,
  RefreshCw,
  Download,
  CheckCircle,
  X,
  DollarSign,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaginationControls } from "@/components/PaginationControls";
import { StatCard, TableShell, THead, SkeletonRows, SectionHead } from "./-shared";
import { fmtDate } from "./helpers";

function ScreenshotThumb({
  path,
  onOpen,
}: {
  path: string;
  onOpen: (url: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    // Legacy rows stored the full https://... URL in screenshot_url. Modern
    // rows store just the path. Detect which we have.
    if (path.startsWith("http://") || path.startsWith("https://")) {
      setUrl(path);
      return;
    }
    // Strip any accidental bucket prefix the path may carry.
    const cleanPath = path.replace(/^uploads\//, "");
    supabase.storage
      .from("uploads")
      .createSignedUrl(cleanPath, 600)
      .then(({ data, error }) => {
        if (data?.signedUrl) setUrl(data.signedUrl);
        else if (error) console.warn("[ScreenshotThumb] sign error:", error.message, "path:", cleanPath);
      });
  }, [path]);

  if (!url) {
    return <div className="size-14 rounded-md border border-border bg-muted/30 animate-pulse" />;
  }

  return (
    <button
      type="button"
      aria-label="View payment proof"
      onClick={() => onOpen(url)}
      className="size-14 shrink-0 rounded-md border border-border hover:border-primary/60 transition-colors overflow-hidden p-0 bg-transparent"
    >
      <img src={url} alt="Payment proof" className="size-full object-cover" />
    </button>
  );
}

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function FinanceSection() {
  const { user } = useAuth();
  type PayRow = {
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    plan_name: string;
    amount_pkr: number;
    payment_method: string;
    status: string;
    screenshot_url: string | null;
    ngo_certificate_url: string | null;
    credits_to_add: number;
    notes: string | null;
    billing_cycle: string;
    created_at: string;
    reviewed_at: string | null;
  };
  const [payments, setPayments] = useState<PayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [actioning, setActioning] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PayRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const load = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("manual_payments")
      .select("*, plans(name)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) {
      toast.error("Failed to load payments: " + error.message);
      setLoading(false);
      return;
    }
    if (!data?.length) {
      setPayments([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set((data as { user_id: string }[]).map((p) => p.user_id))];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profiles } = await (supabase as any)
      .from("profiles")
      .select("id,full_name,email")
      .in("id", userIds);
    const profMap: Record<string, { full_name: string | null; email: string | null }> = {};
    (profiles ?? []).forEach((p) => {
      profMap[p.id] = p;
    });

    setPayments(
      data.map((p) => ({
        id: p.id,
        user_id: p.user_id,
        user_name: profMap[p.user_id]?.full_name ?? "Unknown",
        user_email: profMap[p.user_id]?.email ?? "-",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        plan_name: (p as any).plans?.name ?? "-",
        amount_pkr: p.amount_pkr,
        payment_method: p.payment_method,
        status: p.status,
        screenshot_url: p.screenshot_url ?? null,
        ngo_certificate_url: p.ngo_certificate_url ?? null,
        credits_to_add: p.credits_to_add,
        notes: p.notes ?? null,
        billing_cycle: p.billing_cycle ?? "monthly",
        created_at: p.created_at,
        reviewed_at: p.reviewed_at ?? null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleApprove = async (p: PayRow) => {
    setActioning(p.id);
    const { error } = await supabase.rpc("approve_payment", {
      p_payment_id: p.id,
      p_admin_id: user!.id,
    });
    if (error) {
      toast.error("Failed: " + error.message);
    } else {
      toast.success(`Approved, ${p.credits_to_add} credits added to ${p.user_name}`);
    }
    setActioning(null);
    void load();
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error("Please provide a rejection reason.");
      return;
    }
    setActioning(rejectTarget.id);
    const { error } = await supabase
      .from("manual_payments")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        admin_notes: reason,
      })
      .eq("id", rejectTarget.id);
    if (error) {
      toast.error("Failed: " + error.message);
    } else {
      // Notify the user with the reason + contact info
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc("create_notification", {
        p_user_id: rejectTarget.user_id,
        p_title:   "Payment rejected",
        p_body:
          `Your payment of PKR ${rejectTarget.amount_pkr.toLocaleString()} was not approved.\n\n` +
          `Reason: ${reason}\n\n` +
          `For more details, contact us:\n` +
          `📞 +92 310 2700403\n` +
          `✉️ contact@babultech.com`,
        p_type: "error",
        p_link: "/billing",
      });
      toast.success("Payment rejected and user notified.");
    }
    setActioning(null);
    setRejectTarget(null);
    setRejectReason("");
    void load();
  };

  const filtered =
    statusFilter === "all" ? payments : payments.filter((p) => p.status === statusFilter);
  // react-doctor-disable-next-line react-doctor/no-derived-state-effect
  // react-doctor-disable-next-line react-doctor/no-chain-state-updates
  useEffect(() => {
    setPage(0);
  }, [statusFilter]);
  const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const approved = payments.filter((p) => p.status === "approved");
  const pending = payments.filter((p) => p.status === "pending");
  const revenue = approved.reduce((s, p) => s + p.amount_pkr, 0);
  const monthRevenue = approved
    .filter((p) => p.created_at >= thisMonth)
    .reduce((s, p) => s + p.amount_pkr, 0);

  const exportCSV = () => {
    const csv = [
      "Date,User,Email,Plan,Cycle,Amount PKR,Method,Status,Credits",
      ...filtered.map(
        (p) =>
          `${fmtDate(p.created_at)},${p.user_name},${p.user_email},${p.plan_name},${p.billing_cycle},${p.amount_pkr},${p.payment_method},${p.status},${p.credits_to_add}`,
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `payments_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const methodBadge = (m: string) => {
    const cfg: Record<string, string> = {
      easypaisa: "bg-[#00A850]/15 text-[#00A850]",
      jazzcash: "bg-[#D9232D]/15 text-[#D9232D]",
      bank_transfer: "bg-primary/15 text-primary",
    };
    const labels: Record<string, string> = {
      easypaisa: "EasyPaisa",
      jazzcash: "JazzCash",
      bank_transfer: "Bank",
    };
    return (
      <Badge className={`${cfg[m] ?? "bg-muted/40 text-muted-foreground"} border-0 text-[10px]`}>
        {labels[m] ?? m}
      </Badge>
    );
  };

  const payStatusBadge = (s: string) => {
    const cfg: Record<string, string> = {
      pending: "bg-warning/15 text-warning",
      approved: "bg-success/15 text-success",
      rejected: "bg-destructive/15 text-destructive",
    };
    return (
      <Badge
        className={`${cfg[s] ?? "bg-muted/40 text-muted-foreground"} border-0 text-[10px] capitalize`}
      >
        {s}
      </Badge>
    );
  };

  return (
    <div className="space-y-5">
      <SectionHead
        title="Payments" aria-label="Payments"
        sub="Manual payment verification, approve or reject screenshot-based payments."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Revenue (PKR)"
          value={`PKR ${revenue.toLocaleString()}`}
          icon={DollarSign}
          color="text-success"
        />
        <StatCard
          label="This Month (PKR)"
          value={`PKR ${monthRevenue.toLocaleString()}`}
          icon={Calendar}
          color="text-primary"
        />
        <StatCard
          label="Pending Review"
          value={pending.length}
          icon={AlertTriangle}
          color="text-warning"
        />
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="size-4 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["all", "pending", "approved", "rejected"].map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5">
          <RefreshCw className="size-4" />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 ml-auto">
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      <TableShell footer={`${filtered.length} payment${filtered.length !== 1 ? "s" : ""}`}>
        <THead
          cols={["Date", "User", "Plan", "Amount", "Method", "Credits", "Status", "Actions"]}
        />
        <tbody className="divide-y divide-border/40">
          {loading ? (
            <SkeletonRows cols={8} />
          ) : paged.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                No payments found.
              </td>
            </tr>
          ) : (
            paged.map((p) => (
              <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {fmtDate(p.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs font-medium">{p.user_name}</div>
                  <div className="text-[11px] text-muted-foreground">{p.user_email}</div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>{p.plan_name}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                        p.billing_cycle === "yearly"
                          ? "bg-emerald-400/15 text-emerald-400 border border-emerald-400/30"
                          : "bg-muted/40 text-muted-foreground border border-border"
                      }`}
                    >
                      {p.billing_cycle === "yearly" ? "Yearly" : "Monthly"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap">
                  PKR {p.amount_pkr.toLocaleString()}
                </td>
                <td className="px-4 py-3">{methodBadge(p.payment_method)}</td>
                <td className="px-4 py-3 text-xs text-center">{p.credits_to_add}</td>
                <td className="px-4 py-3">{payStatusBadge(p.status)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {p.screenshot_url && (
                      <div className="flex flex-col items-center gap-0.5">
                        <ScreenshotThumb
                          path={p.screenshot_url}
                          onOpen={setScreenshotUrl}
                        />
                        <span className="text-[9px] text-muted-foreground">Payment</span>
                      </div>
                    )}
                    {p.ngo_certificate_url && (
                      <div className="flex flex-col items-center gap-0.5">
                        <ScreenshotThumb
                          path={p.ngo_certificate_url}
                          onOpen={setScreenshotUrl}
                        />
                        <span className="text-[9px] text-emerald-400 font-semibold">NGO</span>
                      </div>
                    )}
                    {p.status === "pending" && (
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-6 px-2 text-[11px] bg-success hover:bg-success/90 text-white gap-1"
                          disabled={actioning === p.id}
                          onClick={() => void handleApprove(p)}
                        >
                          <CheckCircle className="size-3" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-6 px-2 text-[11px] gap-1"
                          disabled={actioning === p.id}
                          onClick={() => { setRejectTarget(p); setRejectReason(""); }}
                        >
                          <X className="size-3" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
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
        label="payments"
        onPageChange={setPage}
      />

      <Dialog open={!!screenshotUrl} onOpenChange={() => setScreenshotUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment Screenshot</DialogTitle>
          </DialogHeader>
          {screenshotUrl && (
            <img
              src={screenshotUrl}
              alt="Payment proof"
              className="w-full rounded-lg object-contain max-h-[70vh]"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Payment</DialogTitle>
          </DialogHeader>
          {rejectTarget && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">
                Rejecting <strong className="text-foreground">{rejectTarget.user_name}</strong>'s payment of{" "}
                <strong className="text-foreground">PKR {rejectTarget.amount_pkr.toLocaleString()}</strong> for{" "}
                <strong className="text-foreground">{rejectTarget.plan_name}</strong>{" "}
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  rejectTarget.billing_cycle === "yearly"
                    ? "bg-emerald-400/15 text-emerald-400"
                    : "bg-muted/40 text-muted-foreground"
                }`}>{rejectTarget.billing_cycle === "yearly" ? "Yearly" : "Monthly"}</span>.
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1.5" htmlFor="reject-reason">
                  Reason for rejection <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="reject-reason"
                  rows={4}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Screenshot is blurry, transaction reference missing, amount doesn't match..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  The user will be notified with this reason + our contact info.
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setRejectTarget(null); setRejectReason(""); }}
                  disabled={actioning === rejectTarget.id}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void submitReject()}
                  disabled={actioning === rejectTarget.id || !rejectReason.trim()}
                >
                  Reject &amp; Notify
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
