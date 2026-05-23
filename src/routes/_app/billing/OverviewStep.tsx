import { Link } from "@tanstack/react-router";
import {
  CreditCard,
  ArrowLeft,
  Zap,
  Plus,
  Clock,
  Coins,
  CheckCircle2,
  XCircle,
  Wand2,
  ScanLine,
} from "lucide-react";
import type { PlanInfo, CreditInfo } from "@/contexts/PlanContext";
import { Collapse } from "./Collapse";
import { StatusChip } from "./StatusChip";
import { CreditTxList } from "./CreditTxList";
import { METHOD_ICONS } from "./constants";
import type { PaymentHistory, CreditTx } from "./types";

type Props = {
  credits: CreditInfo;
  currentPlan: PlanInfo | null;
  isFreeUser: boolean;
  canBuyCredits: boolean;
  history: PaymentHistory[];
  creditTx: CreditTx[];
  onPickPack: () => void;
  onPickPlan: () => void;
};

export function OverviewStep({
  credits,
  currentPlan,
  isFreeUser,
  canBuyCredits,
  history,
  creditTx,
  onPickPack,
  onPickPlan,
}: Props) {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Hero */}
      <div className="rounded-2xl border border-border bg-card/60 p-5 flex flex-wrap items-center gap-4">
        <div className="size-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-glow shrink-0">
          <CreditCard className="size-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight">
            Billing &amp; Credits
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            PKR payments via EasyPaisa · JazzCash · Bank Transfer
          </p>
        </div>
        <Link
          to="/settings"
          search={{ tab: "plan" }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shrink-0 min-h-[36px]"
        >
          <ArrowLeft className="size-3.5" /> Settings
        </Link>
      </div>

      {/* Balance */}
      <div className="rounded-2xl border border-warning/30 bg-warning/5 p-6">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold text-center">
          Your Credit Balance
        </p>
        <p className="font-display text-7xl font-bold text-warning text-center mt-2 tabular-nums">
          {credits.balance}
        </p>
        <div className="flex justify-center gap-8 mt-4 text-xs text-muted-foreground">
          <div className="text-center">
            <p className="font-bold text-success text-base">+{credits.total_earned}</p>
            <p>total earned</p>
          </div>
          <div className="h-8 w-px bg-border self-center" />
          <div className="text-center">
            <p className="font-bold text-foreground text-base">−{credits.total_spent}</p>
            <p>total spent</p>
          </div>
        </div>
        {currentPlan && (
          <p className="text-center text-[11px] text-muted-foreground mt-3">
            Current plan: <span className="font-semibold text-foreground">{currentPlan.name}</span>
          </p>
        )}
      </div>

      {/* Actions */}
      {isFreeUser ? (
        <button
          type="button"
          onClick={onPickPlan}
          className="w-full h-14 rounded-2xl bg-gradient-primary text-primary-foreground font-bold text-base shadow-glow flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Zap className="size-5" /> Choose a Plan to Get Started
        </button>
      ) : (
        <div className={`grid gap-3 ${canBuyCredits ? "grid-cols-2" : "grid-cols-1"}`}>
          {canBuyCredits && (
            <button
              type="button"
              onClick={onPickPack}
              className="h-14 rounded-2xl bg-gradient-primary text-primary-foreground font-bold shadow-glow flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Plus className="size-5" /> Buy Credits
            </button>
          )}
          <button
            type="button"
            onClick={onPickPlan}
            className="h-14 rounded-2xl border border-border bg-card/60 font-semibold text-sm flex items-center justify-center gap-2 hover:border-primary/40 hover:bg-muted/20 transition-all"
          >
            <Zap className="size-4 text-primary" /> Change Plan
          </button>
        </div>
      )}

      {/* Credit costs */}
      {currentPlan && (
        <Collapse label="What do credits cost on your plan?" icon={Zap}>
          <div className="space-y-2 mt-2">
            {[
              {
                icon: Wand2,
                label: "AI Generate (per question)",
                cost: Math.max(1, Math.ceil(currentPlan.credit_cost_ai_10q / 10)),
              },
              {
                icon: ScanLine,
                label: "AI Image Scan / OCR",
                cost: currentPlan.credit_cost_ai_scan,
              },
              {
                icon: Zap,
                label: "Launch Quiz Session",
                cost: currentPlan.credit_cost_session_launch,
              },
              {
                icon: CheckCircle2,
                label: "Export PDF / Excel",
                cost: currentPlan.credit_cost_export,
              },
            ].map(({ icon: Icon, label, cost }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-2.5"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Icon className="size-3.5 text-primary/70 shrink-0" />
                  {label}
                </div>
                <span className="font-bold text-warning text-sm ml-4 shrink-0">{cost} cr</span>
              </div>
            ))}
          </div>
        </Collapse>
      )}

      {/* Payment history */}
      {history.length > 0 && (
        <Collapse label={`Payment History (${history.length})`} icon={Clock}>
          <div className="space-y-2 mt-2">
            {history.map((pay) => (
              <div
                key={pay.id}
                className="flex items-center gap-3 rounded-xl bg-secondary/30 px-4 py-2.5"
              >
                <div className="shrink-0">
                  {pay.status === "approved" ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : pay.status === "rejected" ? (
                    <XCircle className="size-4 text-destructive" />
                  ) : (
                    <Clock className="size-4 text-warning" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">PKR {pay.amount_pkr}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {METHOD_ICONS[pay.payment_method]} {pay.payment_method.replace("_", " ")} ·{" "}
                    {new Date(pay.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <StatusChip status={pay.status} />
                  {pay.status === "approved" && pay.credits_to_add > 0 && (
                    <div className="text-[10px] text-warning mt-0.5">+{pay.credits_to_add} cr</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Collapse>
      )}

      {/* Credit transactions */}
      {creditTx.length > 0 && (
        <Collapse label={`Credit Transactions (${creditTx.length})`} icon={Coins}>
          <CreditTxList items={creditTx} />
        </Collapse>
      )}
    </div>
  );
}
