import { Link } from "@tanstack/react-router";
import {
  Coins,
  History,
  Plus,
  RefreshCw,
  SendHorizonal,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MemberRow, TxRow } from "./types";
import { TX_LABEL } from "./types";
import type { CreditInfo } from "@/contexts/PlanContext";

type Props = {
  credits: CreditInfo;
  members: MemberRow[];
  txList: TxRow[];
  txLoading: boolean;
  showCredits: boolean;
  onRefreshTx: () => void;
  onSendCredit: (m: MemberRow) => void;
};

export function CreditsTab({
  credits,
  members,
  txList,
  txLoading,
  showCredits,
  onRefreshTx,
  onSendCredit,
}: Props) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl md:rounded-2xl border border-warning/30 bg-warning/5 p-4 md:p-5 sm:col-span-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1">
            <Coins className="size-3.5" /> Available Pool
          </div>
          <div className="font-display text-4xl font-bold text-warning">{credits.balance}</div>
          <div className="text-xs text-muted-foreground mt-1">credits remaining</div>
          <Link
            to="/billing"
            search={{ plan: "" }}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            <Plus className="size-3.5" /> Buy more credits
          </Link>
        </div>
        <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1">
            <TrendingUp className="size-3.5" /> Total Earned
          </div>
          <div className="font-display text-3xl font-bold text-success">{credits.total_earned}</div>
          <div className="text-xs text-muted-foreground mt-1">all-time credits received</div>
        </div>
        <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1">
            <TrendingDown className="size-3.5" /> Total Spent
          </div>
          <div className="font-display text-3xl font-bold">{credits.total_spent}</div>
          <div className="text-xs text-muted-foreground mt-1">credits used so far</div>
        </div>
      </div>

      {members.length > 0 && (
        <div className="rounded-xl md:rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/40 border-b border-border text-sm font-semibold flex items-center gap-2">
            <Users className="size-4 text-primary" /> Host Credit Snapshot
          </div>
          <div className="divide-y divide-border">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 sm:px-4">
                <div className="size-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {m.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{m.full_name}</div>
                  <div className="text-xs text-muted-foreground">{m.invited_email}</div>
                </div>
                {showCredits && (
                  <div className="text-right shrink-0">
                    <div className="font-bold text-warning">
                      {m.user_id ? (m.balance ?? 0) : "-"}
                    </div>
                    <div className="text-[10px] text-muted-foreground">balance</div>
                  </div>
                )}
                {showCredits && (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 sm:h-7 px-2 text-[11px] gap-1 text-success border-success/30 hover:bg-success/10"
                      onClick={() => onSendCredit(m)}
                    >
                      <SendHorizonal className="size-3" /> Send
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl md:rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold flex items-center gap-2">
            <History className="size-4 text-primary" /> Credit Transaction History
          </div>
          <Button size="sm" variant="ghost" onClick={onRefreshTx} className="size-7 p-0">
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
        {txLoading ? (
          <div className="divide-y divide-border animate-pulse">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 px-4 flex items-center gap-3">
                <div className="size-8 rounded-lg bg-muted/40 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-muted/40 rounded w-1/3" />
                  <div className="h-2.5 bg-muted/30 rounded w-1/2" />
                </div>
                <div className="h-4 w-10 bg-muted/40 rounded" />
              </div>
            ))}
          </div>
        ) : txList.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No transactions yet.
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {txList.map((tx) => {
              const isAdd = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
                >
                  <div
                    className={`rounded-lg p-1.5 shrink-0 ${isAdd ? "bg-success/15" : "bg-warning/15"}`}
                  >
                    {isAdd ? (
                      <TrendingUp className="size-3.5 text-success" />
                    ) : (
                      <TrendingDown className="size-3.5 text-warning" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {TX_LABEL[tx.type] ?? tx.type.replace(/_/g, " ")}
                    </div>
                    {tx.description && (
                      <div className="text-xs text-muted-foreground truncate">{tx.description}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div
                    className={`text-sm font-bold shrink-0 ${isAdd ? "text-success" : "text-warning"}`}
                  >
                    {isAdd ? "+" : ""}
                    {tx.amount}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
