import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, Clock, Plus, Send, Wallet } from "lucide-react";
import { toast } from "sonner";
import { validationError } from "@/components/ui/validation-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { HostInfo } from "@/contexts/HostContext";
import type { CreditTx } from "./types";

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function HostDashboard({ host, userId }: { host: HostInfo; userId: string }) {
  const [txs, setTxs] = useState<CreditTx[]>([]);
  const [stats, setStats] = useState({ sessions: 0, active: 0 });
  const [requesting, setRequesting] = useState(false);
  const [reqAmount, setReqAmount] = useState("");
  const [showReqForm, setShowReqForm] = useState(false);

  useEffect(() => {
    (async () => {
      const [txRes, sessRes, activeRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("credit_transactions")
          .select("id, amount, type, description, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("quiz_sessions")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", userId),
        supabase
          .from("quiz_sessions")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", userId)
          .eq("status", "active"),
      ]);
      setTxs(txRes.data ?? []);
      setStats({ sessions: sessRes.count ?? 0, active: activeRes.count ?? 0 });
    })();
  }, [userId]);

  const handleRequestCredits = async () => {
    const amount = parseInt(reqAmount);
    if (!amount || amount <= 0) {
      validationError("Enter a valid amount");
      return;
    }
    setRequesting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("credit_requests").insert({
      member_id: host.member_id,
      requester_user_id: userId,
      company_id: host.company_id,
      amount,
      note: null,
      status: "pending",
    });
    setRequesting(false);
    if (error) {
      toast.error(`Failed to send request: ${error.message}`);
      return;
    }
    toast.success("Credit request sent to your admin!");
    setShowReqForm(false);
    setReqAmount("");
  };

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="size-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">
              {host.company_name}
            </span>
          </div>
          <h1 className="font-display text-2xl font-semibold">
            Welcome back, {host.full_name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your role: <span className="capitalize font-medium text-foreground">{host.role}</span>
          </p>
        </div>
        <Link to="/sessions/new" className="w-full sm:w-auto">
          <Button className="h-12 w-full sm:w-auto px-6 bg-gradient-primary shadow-glow font-semibold text-base gap-2">
            <Plus size={18} /> Start Session
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl md:rounded-2xl border border-warning/30 bg-warning/5 p-3 sm:p-4 min-h-[92px]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Credits
          </div>
          <div className="font-display text-2xl font-bold text-warning mt-1">{host.balance}</div>
          <div className="text-[10px] text-muted-foreground mt-1">
            of {host.total_earned} earned
          </div>
        </div>
        <Link
          to="/sessions"
          className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-3 sm:p-4 hover:border-primary/50 transition-all min-h-[92px]"
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Sessions
          </div>
          <div className="font-display text-2xl font-bold mt-1">{stats.sessions}</div>
        </Link>
        <Link
          to="/sessions"
          className="rounded-xl md:rounded-2xl border border-success/20 bg-success/5 p-3 sm:p-4 hover:border-success/50 transition-all min-h-[92px]"
        >
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Active
          </div>
          <div className="font-display text-2xl font-bold text-success mt-1">{stats.active}</div>
        </Link>
      </div>

      <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-warning" />
          <h3 className="font-semibold text-sm">Credit Balance</h3>
          <span className="ml-auto text-xs text-muted-foreground">
            Earned +{host.total_earned} · Spent -{host.total_spent}
          </span>
        </div>
        {!showReqForm ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-2 h-9"
            onClick={() => setShowReqForm(true)}
          >
            <Send className="size-3.5" /> Request More Credits
          </Button>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
            <input
              type="number"
              min={1}
              aria-label="Credits amount to request"
              value={reqAmount}
              onChange={(e) => setReqAmount(e.target.value)}
              placeholder="Amount"
              className="h-10 w-28 rounded-lg border border-border bg-background px-3 text-sm"
            />
            <Button
              size="sm"
              onClick={handleRequestCredits}
              disabled={requesting}
              className="gap-1.5 bg-gradient-primary text-primary-foreground h-10"
            >
              <Send className="size-3.5" /> {requesting ? "Sending…" : "Send"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowReqForm(false)}
              className="h-10"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="size-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Recent Transactions</h3>
        </div>
        {txs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
        ) : (
          <ul className="space-y-2">
            {txs.map((tx) => (
              <li
                key={tx.id}
                className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2.5"
              >
                <div>
                  <div className="text-sm font-medium capitalize">
                    {(tx.description ?? tx.type).replace(/_/g, " ")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span
                  className={`text-sm font-bold ${tx.amount > 0 ? "text-success" : tx.amount < 0 ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {tx.amount > 0 ? `+${tx.amount}` : tx.amount === 0 ? "Req" : tx.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
