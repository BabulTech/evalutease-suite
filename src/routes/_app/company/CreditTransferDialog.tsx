import { AlertCircle, Coins, MinusCircle, PlusCircle, SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MemberRow } from "./types";

type Props = {
  creditTarget: MemberRow | null;
  creditAction: "send" | "deduct";
  creditAmt: string;
  creditNote: string;
  transferring: boolean;
  creditsBalance: number;
  onClose: () => void;
  onAmtChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onConfirm: () => void;
};

export function CreditTransferDialog({
  creditTarget,
  creditAction,
  creditAmt,
  creditNote,
  transferring,
  creditsBalance,
  onClose,
  onAmtChange,
  onNoteChange,
  onConfirm,
}: Props) {
  return (
    <Dialog
      open={!!creditTarget}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-sm [&_input]:min-h-11 sm:[&_input]:min-h-9">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {creditAction === "send" ? (
              <>
                <PlusCircle className="size-5 text-success" /> Send Credits
              </>
            ) : (
              <>
                <MinusCircle className="size-5 text-destructive" /> Deduct Credits
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        {creditTarget && (
          <div className="space-y-4 pt-1">
            <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
              <div className="font-semibold text-sm">{creditTarget.full_name}</div>
              <div className="text-xs text-muted-foreground">{creditTarget.invited_email}</div>
              <div className="mt-1.5 flex items-center gap-2 text-xs">
                <Coins className="size-3.5 text-warning" />
                <span className="font-bold text-warning">
                  {creditTarget.user_id ? (creditTarget.balance ?? 0) : "-"} cr
                </span>
                <span className="text-muted-foreground">balance</span>
              </div>
              {!creditTarget.user_id && (
                <div className="mt-2 rounded-lg bg-warning/10 border border-warning/20 px-3 py-2 text-xs text-warning flex items-start gap-1.5">
                  <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                  Host hasn't signed up yet. Share their invite link so they can join first.
                </div>
              )}
            </div>
            {creditAction === "send" && (
              <div className="rounded-xl border border-warning/20 bg-warning/5 px-3 py-2 flex items-center gap-2 text-xs">
                <Coins className="size-3.5 text-warning shrink-0" />
                Your pool:{" "}
                <span className="font-bold text-warning ml-1">{creditsBalance} credits</span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Amount (credits)
              </Label>
              <Input
                type="number"
                min={1}
                value={creditAmt}
                onChange={(e) => onAmtChange(e.target.value)}
                placeholder="e.g. 100"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Note (optional)
              </Label>
              <Input
                value={creditNote}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder="Reason…"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="ghost"
                className="h-11 flex-1"
                onClick={onClose}
                disabled={transferring}
              >
                Cancel
              </Button>
              <Button
                className={`h-11 flex-1 gap-1.5 ${creditAction === "send" ? "bg-success hover:bg-success/90 text-white" : ""}`}
                variant={creditAction === "deduct" ? "destructive" : "default"}
                onClick={onConfirm}
                disabled={transferring || !creditTarget.user_id || !creditAmt}
              >
                {creditAction === "send" ? (
                  <SendHorizonal className="size-4" />
                ) : (
                  <MinusCircle className="size-4" />
                )}
                {transferring
                  ? "Processing…"
                  : `${creditAction === "send" ? "Send" : "Deduct"} ${creditAmt || 0} cr`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
