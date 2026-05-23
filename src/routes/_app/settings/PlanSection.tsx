import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, Clock, CreditCard, Crown, Wallet, Zap, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/contexts/PlanContext";
import { useHost, type HostInfo } from "@/contexts/HostContext";

function HostWorkspaceSection({ host, userId }: { host: HostInfo; userId: string }) {
  const [recentTx, setRecentTx] = useState<
    Array<{
      id: string;
      amount: number;
      type: string;
      description: string | null;
      created_at: string;
    }>
  >([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("credit_transactions")
        .select("id, amount, type, description, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8);
      setRecentTx((data ?? []) as typeof recentTx);
    })();
  }, [userId]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl md:rounded-2xl border border-primary/30 bg-card/60 p-4 md:p-5 grid sm:grid-cols-3 gap-4 md:gap-5">
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Organization
          </div>
          <div className="font-semibold text-base flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            {host.company_name}
          </div>
          <div className="text-xs text-muted-foreground">
            Your role: <span className="capitalize font-medium text-foreground">{host.role}</span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Admin
          </div>
          <div className="font-semibold text-sm">{host.admin_name ?? "Admin"}</div>
          <div className="text-xs text-muted-foreground">{host.admin_email ?? "-"}</div>
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Org Plan
          </div>
          <div className="flex items-center gap-2">
            <Crown className="size-4 text-warning" />
            <span className="font-semibold text-sm">{host.org_plan_name ?? "-"}</span>
          </div>
          <div className="text-xs text-muted-foreground capitalize">
            {host.org_plan_slug?.replace(/_/g, " ") ?? ""}
          </div>
        </div>
      </div>

      <div className="rounded-xl md:rounded-2xl border border-warning/30 bg-warning/5 p-4 md:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-warning/20 p-2">
              <Wallet className="size-5 text-warning" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Available Credits
              </div>
              <div className="font-display text-3xl font-bold text-warning">{host.balance}</div>
            </div>
          </div>
          <div className="text-right text-xs space-y-0.5">
            <div className="text-muted-foreground">
              Earned: <span className="font-semibold text-success">+{host.total_earned}</span>
            </div>
            <div className="text-muted-foreground">
              Spent: <span className="font-semibold text-foreground">-{host.total_spent}</span>
            </div>
          </div>
        </div>
        <Link
          to="/billing"
          search={{ plan: "" }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          Request more credits from admin →
        </Link>
      </div>

      <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="size-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Recent Credit Activity</h3>
        </div>
        {recentTx.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No transactions yet</p>
        ) : (
          <ul className="space-y-2">
            {recentTx.map((tx) => (
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
                  {tx.amount > 0 ? `+${tx.amount}` : tx.amount === 0 ? "Pending" : tx.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function PlanSection({ userId }: { userId: string }) {
  const { plan: ctxPlan, credits, usage, usedPct, allPlans } = usePlan();
  const { isHost, hostInfo, loading: hostLoading } = useHost();
  const [tierFilter, setTierFilter] = useState<"individual" | "enterprise">("individual");

  if (hostLoading) return null;
  if (isHost && hostInfo) return <HostWorkspaceSection host={hostInfo} userId={userId} />;

  const visiblePlans = allPlans.filter((p) => p.tier === tierFilter);

  const usageItems = [
    {
      label: "Quizzes today",
      used: usage.quizzes_today,
      pct: usedPct("quizzes_per_day"),
      limit: ctxPlan?.quizzes_per_day ?? 3,
    },
    {
      label: "Question bank",
      used: usage.questions_total,
      pct: usedPct("question_bank"),
      limit: ctxPlan?.question_bank ?? 50,
    },
    {
      label: "Participants",
      used: usage.participants_total,
      pct: usedPct("participants_total"),
      limit: ctxPlan?.participants_total ?? 50,
    },
    {
      label: "Total sessions",
      used: usage.sessions_total,
      pct: usedPct("sessions_total"),
      limit: ctxPlan?.sessions_total ?? -1,
    },
  ];

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="rounded-xl md:rounded-2xl border border-primary/30 bg-card/60 p-4 md:p-5 shadow-glow">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-xl">{ctxPlan?.name ?? "Starter"}</span>
              <Badge className="bg-primary/15 text-primary border-0 text-[10px]">
                Current Plan
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(ctxPlan?.price_pkr ?? 0) === 0 ? "Free forever" : `PKR ${ctxPlan?.price_pkr}/month`}
              {ctxPlan?.ai_enabled && (
                <span className="ml-2 inline-flex items-center gap-0.5 text-success">
                  <Zap className="size-3" /> AI Enabled
                </span>
              )}
            </p>
          </div>
          {ctxPlan &&
            !["individual_starter", "enterprise_starter", "enterprise_free"].includes(
              ctxPlan.slug,
            ) && (
              <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5 text-center sm:min-w-[120px]">
                <div className="font-display text-2xl font-bold text-warning">
                  {credits.balance}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Credits
                </div>
                <Link
                  to="/billing"
                  search={{ plan: "" }}
                  className="text-[10px] text-primary hover:underline mt-0.5 block"
                >
                  Buy more →
                </Link>
              </div>
            )}
        </div>

        {ctxPlan?.ai_enabled && (
          <div className="mb-4 rounded-xl border border-border bg-muted/20 p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Generate 10 Qs</span>
              <span className="font-semibold">{ctxPlan.credit_cost_ai_10q} credits</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">OCR Scan</span>
              <span className="font-semibold">{ctxPlan.credit_cost_ai_scan} credits</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Extra Quiz Slot</span>
              <span className="font-semibold">{ctxPlan.credit_cost_extra_quiz} credit</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-3">
          {usageItems.map((item) => {
            const danger = item.pct >= 80 && item.limit !== -1;
            const unlimited = item.limit === -1;
            return (
              <div key={item.label} className="rounded-xl border border-border bg-card/30 p-3">
                <div className="text-[10px] text-muted-foreground mb-1">{item.label}</div>
                <div className={`text-sm font-semibold mb-1.5 ${danger ? "text-destructive" : ""}`}>
                  {item.used}
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    / {unlimited ? "∞" : item.limit}
                  </span>
                </div>
                {unlimited ? (
                  <div className="h-1 rounded-full bg-success/30">
                    <div className="size-full rounded-full bg-success/50" />
                  </div>
                ) : (
                  <Progress
                    value={item.pct}
                    className={`h-1 ${danger ? "[&>div]:bg-destructive" : ""}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 p-1 rounded-xl bg-muted/40 w-fit mx-auto">
        {(["individual", "enterprise"] as const).map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => setTierFilter(tier)}
            className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize ${
              tierFilter === tier
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tier === "individual" ? "Individual" : "Enterprise / School"}
          </button>
        ))}
      </div>

      {visiblePlans.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-xl md:rounded-2xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {visiblePlans.map((plan) => {
            const isCurrent = ctxPlan?.slug === plan.slug;
            const isPopular = plan.slug === "individual_pro" || plan.slug === "enterprise_pro";
            return (
              <div
                key={plan.id}
                className={`relative rounded-xl md:rounded-2xl border p-4 md:p-5 flex flex-col gap-4 transition-all duration-300 hover:shadow-glow ${
                  isCurrent
                    ? "border-primary/60 bg-primary/5 shadow-glow"
                    : "border-border bg-card/40"
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 shadow-glow">
                    Most Popular
                  </span>
                )}
                <div className="flex items-center gap-2">
                  <div className={`rounded-xl p-2 ${isCurrent ? "bg-primary/20" : "bg-muted/40"}`}>
                    <CreditCard className="size-4 text-primary" />
                  </div>
                  <span className="font-display font-bold">{plan.name}</span>
                  {isCurrent && (
                    <Badge className="ml-auto bg-primary/20 text-primary border-0 text-[9px]">
                      Active
                    </Badge>
                  )}
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-3xl font-bold">
                      {plan.price_pkr === 0 ? "Free" : `PKR ${plan.price_pkr}`}
                    </span>
                    {plan.price_pkr > 0 && (
                      <span className="text-xs text-muted-foreground">/month</span>
                    )}
                  </div>
                  {plan.credits_per_month > 0 && (
                    <div className="text-xs text-warning font-semibold mt-0.5">
                      {plan.credits_per_month} credits/month included
                    </div>
                  )}
                  {plan.description && (
                    <p className="text-[11px] text-muted-foreground mt-1">{plan.description}</p>
                  )}
                </div>
                <ul className="space-y-1.5 flex-1">
                  {plan.features_list.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Check className="size-3.5 text-success mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <Button size="sm" variant="outline" disabled className="w-full">
                    Current Plan
                  </Button>
                ) : (
                  <Link
                    to="/billing"
                    search={{ plan: plan.slug }}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-primary text-primary-foreground text-sm font-semibold px-4 py-2 shadow-glow hover:opacity-90 transition-opacity"
                  >
                    <Zap className="size-3.5" /> Get {plan.name}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Pay via EasyPaisa, JazzCash, or Bank Transfer.{" "}
        <a
          href="mailto:support@evalutease.com"
          className="text-primary underline-offset-4 hover:underline"
        >
          Contact support
        </a>
      </p>
    </div>
  );
}
