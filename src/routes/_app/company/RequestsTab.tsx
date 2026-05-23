import { AlertCircle, BadgeCheck, Coins, RefreshCw, SendHorizonal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CreditRequestRow } from "./types";
import type { CreditInfo } from "@/contexts/PlanContext";

type Props = {
  reqList: CreditRequestRow[];
  reqLoading: boolean;
  pendingCount: number;
  resolvingId: string | null;
  credits: CreditInfo;
  onRefresh: () => void;
  onApprove: (id: string) => void;
  onDecline: (id: string) => void;
};

export function RequestsTab({
  reqList,
  reqLoading,
  pendingCount,
  resolvingId,
  credits,
  onRefresh,
  onApprove,
  onDecline,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Credit Requests</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pendingCount > 0
              ? `${pendingCount} pending · ${reqList.length} total`
              : reqList.length === 0
                ? "No requests yet"
                : `${reqList.length} processed`}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onRefresh} className="h-10 gap-1.5">
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      {reqLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card/40 h-24" />
          ))}
        </div>
      ) : reqList.length === 0 ? (
        <div className="rounded-xl md:rounded-2xl border border-dashed border-border bg-muted/10 py-14 text-center">
          <SendHorizonal className="size-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium text-sm text-muted-foreground">No credit requests yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            When your hosts request more credits, they'll appear here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reqList.map((r) => {
            const isPending = r.status === "pending";
            const isApproved = r.status === "approved";
            const insufficient = isPending && r.amount > credits.balance;
            return (
              <div
                key={r.id}
                className={`rounded-xl md:rounded-2xl border p-4 flex flex-col min-[460px]:flex-row min-[460px]:items-start gap-4 transition-colors ${
                  isPending
                    ? "border-warning/30 bg-warning/5"
                    : isApproved
                      ? "border-success/20 bg-success/5"
                      : "border-border bg-muted/10"
                }`}
              >
                <div className="size-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                  {(r.requester_name ?? r.requester_email ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">
                      {r.requester_name ?? r.requester_email ?? "Host"}
                    </span>
                    {isPending && (
                      <span className="inline-flex items-center rounded-full bg-warning/15 text-warning px-2 py-0.5 text-[10px] font-semibold">
                        Pending
                      </span>
                    )}
                    {isApproved && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-semibold">
                        <BadgeCheck className="size-2.5" /> Approved
                      </span>
                    )}
                    {r.status === "declined" && (
                      <span className="inline-flex items-center rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[10px] font-semibold">
                        Declined
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {r.requester_email ?? ""}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-bold text-warning text-base flex items-center gap-1">
                      <Coins className="size-3.5" /> {r.amount} credits
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {r.note && (
                    <div className="mt-2 text-xs text-muted-foreground bg-background/60 rounded-lg px-3 py-1.5 border border-border">
                      "{r.note}"
                    </div>
                  )}
                  {insufficient && (
                    <div className="mt-2 text-[11px] text-destructive flex items-center gap-1.5">
                      <AlertCircle className="size-3" /> Your pool ({credits.balance} cr) is less
                      than requested
                    </div>
                  )}
                </div>
                {isPending && (
                  <div className="grid grid-cols-2 min-[460px]:flex min-[460px]:flex-col gap-1.5 shrink-0 w-full min-[460px]:w-auto">
                    <Button
                      size="sm"
                      onClick={() => onApprove(r.id)}
                      disabled={resolvingId === r.id || insufficient}
                      className="h-10 min-[460px]:h-8 px-3 text-[11px] gap-1 bg-success hover:bg-success/90 text-white"
                    >
                      <BadgeCheck className="size-3" /> {resolvingId === r.id ? "…" : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDecline(r.id)}
                      disabled={resolvingId === r.id}
                      className="h-10 min-[460px]:h-8 px-3 text-[11px] gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      <X className="size-3" /> Decline
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
