import { useState } from "react";
import { Wallet, Send, Clock } from "lucide-react";
import { toast } from "sonner";
import { validationError } from "@/components/ui/validation-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Collapse } from "./Collapse";
import { CreditTxList } from "./CreditTxList";
import type { HostInfo } from "@/contexts/HostContext";
import type { CreditTx } from "./types";

type Props = { hostMember: HostInfo; userId: string; creditTx: CreditTx[] };

export function HostBillingView({ hostMember, userId, creditTx }: Props) {
  const [reqAmount, setReqAmount] = useState("");
  const [reqNote, setReqNote] = useState("");
  const [requesting, setRequesting] = useState(false);

  const handleRequest = async () => {
    const amount = parseInt(reqAmount);
    if (!amount || amount <= 0) {
      validationError("Enter a valid amount");
      return;
    }
    setRequesting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- credit_requests table not yet in generated Supabase types
    const { error } = await (supabase as any).from("credit_requests").insert({
      member_id: hostMember.member_id,
      requester_user_id: userId,
      company_id: hostMember.company_id,
      amount,
      note: reqNote.trim() || null,
      status: "pending",
    });
    setRequesting(false);
    if (error) {
      toast.error(`Failed: ${error.message}`);
      return;
    }
    toast.success("Request sent to your admin!");
    setReqAmount("");
    setReqNote("");
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="rounded-2xl border border-border bg-card/60 p-5 flex items-center gap-4">
        <div className="size-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow shrink-0">
          <Wallet className="size-6" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-tight">
            Credits &amp; Billing
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{hostMember.company_name}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-warning/30 bg-warning/5 p-6 text-center space-y-1">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
          Available Credits
        </p>
        <p className="font-display text-6xl font-bold text-warning">{hostMember.balance}</p>
        <div className="flex justify-center gap-6 text-xs text-muted-foreground mt-2">
          <span>
            Earned <span className="font-semibold text-success">+{hostMember.total_earned}</span>
          </span>
          <span>
            Spent <span className="font-semibold text-foreground">−{hostMember.total_spent}</span>
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Send className="size-4 text-primary" />
          <h2 className="font-semibold text-sm">Request Credits from Admin</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Amount</span>
            <input
              type="number"
              min={1}
              aria-label="Credits amount"
              value={reqAmount}
              onChange={(e) => setReqAmount(e.target.value)}
              placeholder="e.g. 50"
              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Reason (optional)</span>
            <input
              type="text"
              aria-label="Reason for credits request"
              value={reqNote}
              onChange={(e) => setReqNote(e.target.value)}
              placeholder="Why you need credits"
              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
        <Button
          onClick={handleRequest}
          disabled={requesting}
          className="w-full h-11 bg-gradient-primary text-primary-foreground shadow-glow gap-2"
        >
          <Send className="size-4" />
          {requesting ? "Sending…" : "Send Request"}
        </Button>
      </div>

      {creditTx.length > 0 && (
        <Collapse label="Credit History" icon={Clock}>
          <CreditTxList items={creditTx} />
        </Collapse>
      )}
    </div>
  );
}
