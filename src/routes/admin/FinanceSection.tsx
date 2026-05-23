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
    credits_to_add: number;
    notes: string | null;
    created_at: string;
    reviewed_at: string | null;
  };
  const [payments, setPayments] = useState<PayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [actioning, setActioning] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("manual_payments")
      .select("*, plans(name)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (!data?.length) {
      setLoading(false);
      return;
    }

    const userIds = [...new Set(data.map((p) => p.user_id))];
    const { data: profiles } = await supabase
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
        credits_to_add: p.credits_to_add,
        notes: p.notes ?? null,
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

  const handleReject = async (p: PayRow) => {
    setActioning(p.id);
    const { error } = await supabase
      .from("manual_payments")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", p.id);
    if (error) {
      toast.error("Failed: " + error.message);
    } else {
      toast.success("Payment rejected.");
    }
    setActioning(null);
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
      "Date,User,Email,Plan,Amount PKR,Method,Status,Credits",
      ...filtered.map(
        (p) =>
          `${fmtDate(p.created_at)},${p.user_name},${p.user_email},${p.plan_name},${p.amount_pkr},${p.payment_method},${p.status},${p.credits_to_add}`,
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
        title="Payments"
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
                <td className="px-4 py-3 text-xs">{p.plan_name}</td>
                <td className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap">
                  PKR {p.amount_pkr.toLocaleString()}
                </td>
                <td className="px-4 py-3">{methodBadge(p.payment_method)}</td>
                <td className="px-4 py-3 text-xs text-center">{p.credits_to_add}</td>
                <td className="px-4 py-3">{payStatusBadge(p.status)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {p.screenshot_url && (
                      <button
                        type="button"
                        aria-label="View payment proof"
                        className="size-14 shrink-0 rounded-md border border-border hover:border-primary/60 transition-colors cursor-pointer p-0 bg-transparent overflow-hidden"
                        onClick={async () => {
                          const { data } = await supabase.storage
                            .from("uploads")
                            .createSignedUrl(p.screenshot_url!, 300);
                          if (data?.signedUrl) setScreenshotUrl(data.signedUrl);
                        }}
                      >
                        <img
                          src="#"
                          alt=""
                          className="size-full object-cover"
                          onLoad={(e) => {
                            const img = e.currentTarget;
                            if (img.src.endsWith("#")) {
                              supabase.storage
                                .from("uploads")
                                .createSignedUrl(p.screenshot_url!, 300)
                                .then(({ data }) => {
                                  if (data?.signedUrl) img.src = data.signedUrl;
                                });
                            }
                          }}
                        />
                      </button>
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
                          onClick={() => void handleReject(p)}
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
    </div>
  );
}
