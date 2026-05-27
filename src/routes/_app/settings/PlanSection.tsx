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
  const { plan: ctxPlan, credits, usage, usedPct, allPlans, loading: planLoading } = usePlan();
  const { isHost, hostInfo, loading: hostLoading, reload: reloadHost } = useHost();
  const [tierFilter, setTierFilter] = useState<"individual" | "enterprise">("individual");

  // Auto-switch tier tab to match user's current plan
  useEffect(() => {
    if (ctxPlan?.tier) setTierFilter(ctxPlan.tier);
  }, [ctxPlan?.tier]);

  // Re-check org membership whenever plan changes (e.g. after admin assigns enterprise plan)
  useEffect(() => {
    if (!planLoading) reloadHost();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctxPlan?.slug]);

  if (hostLoading) return null;
  if (isHost && hostInfo) return <HostWorkspaceSection host={hostInfo} userId={userId} />;

  const visiblePlans = allPlans
    .filter((p) => p.tier === tierFilter)
    .sort((a, b) => a.price_pkr - b.price_pkr);

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
    <div className="space-y-6">
      {/* Hero current-plan card */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card/60 to-card/40 p-5 md:p-6 shadow-glow">
        <div className="absolute -top-12 -right-12 size-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 mb-5">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-primary/20 border border-primary/30 p-3">
              <Crown className="size-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center flex-wrap gap-2">
                <span className="font-display font-bold text-2xl">{ctxPlan?.name ?? "Starter"}</span>
                <Badge className="bg-primary/15 text-primary border-0 text-[10px] uppercase tracking-wider">
                  Active
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {(ctxPlan?.price_pkr ?? 0) === 0
                  ? "Free forever"
                  : <><span className="font-semibold text-foreground">PKR {ctxPlan?.price_pkr?.toLocaleString()}</span> / month</>}
                {ctxPlan?.ai_enabled && (
                  <span className="ml-2 inline-flex items-center gap-1 text-success text-xs font-semibold">
                    <Zap className="size-3" /> AI Enabled
                  </span>
                )}
              </p>
            </div>
          </div>
          {ctxPlan &&
            !["individual_starter", "enterprise_free"].includes(ctxPlan.slug) && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 px-5 py-3 text-center min-w-[140px]">
                <div className="font-display text-3xl font-bold text-warning leading-none">
                  {credits.balance.toLocaleString()}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                  Credits
                </div>
                <Link
                  to="/billing"
                  search={{ plan: "" }}
                  className="text-[11px] text-primary hover:underline mt-1 inline-block font-semibold"
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

      {/* Compare plans header + tier toggle */}
      <div className="text-center space-y-3">
        <h3 className="font-display text-2xl font-bold">Choose your plan</h3>
        <p className="text-sm text-muted-foreground">Switch tier to compare. All plans use the same credit system.</p>
        <div className="inline-flex p-1 rounded-full bg-muted/40 border border-border">
          {(["individual", "enterprise"] as const).map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => setTierFilter(tier)}
              className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                tierFilter === tier
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tier === "individual" ? "Personal" : "Enterprise / Education"}
            </button>
          ))}
        </div>
      </div>

      {planLoading || visiblePlans.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {[1, 2].map((i) => (
            <div key={i} className="h-[480px] rounded-2xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {visiblePlans.map((plan) => {
            const isCurrent = ctxPlan?.slug === plan.slug;
            const isFree = plan.price_pkr === 0;
            const isPopular = plan.slug === "individual_pro" || plan.slug === "enterprise_pro";
            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl border-2 p-6 flex flex-col gap-5 transition-all duration-300 ${
                  isCurrent
                    ? "border-primary bg-primary/5 shadow-glow"
                    : isPopular
                      ? "border-primary/30 bg-card/60 hover:border-primary/60 hover:shadow-glow"
                      : "border-border bg-card/40 hover:border-primary/30"
                }`}
              >
                {isPopular && !isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 shadow-glow whitespace-nowrap">
                    ⭐ Most Popular
                  </span>
                )}

                {/* Header */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`rounded-xl p-2 ${isCurrent || isPopular ? "bg-primary/20" : "bg-muted/40"}`}>
                      {isFree ? <CreditCard className="size-4 text-primary" /> : <Crown className="size-4 text-primary" />}
                    </div>
                    <span className="font-display font-bold text-lg">{plan.name}</span>
                    {isCurrent && (
                      <Badge className="ml-auto bg-success/20 text-success border-0 text-[10px] uppercase">
                        Active
                      </Badge>
                    )}
                  </div>
                  {plan.description && (
                    <p className="text-xs text-muted-foreground">{plan.description}</p>
                  )}
                </div>

                {/* Price */}
                <div className="border-y border-border/60 py-4">
                  {isFree ? (
                    <div className="font-display text-4xl font-bold text-primary">Free</div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-muted-foreground">PKR</span>
                      <span className="font-display text-4xl font-bold">{plan.price_pkr.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground ml-1">/month</span>
                    </div>
                  )}
                  {plan.credits_per_month > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-warning/10 text-warning px-3 py-1 text-xs font-semibold">
                      <Zap className="size-3" /> {plan.credits_per_month.toLocaleString()} credits/month
                    </div>
                  )}
                  {isFree && tierFilter === "enterprise" && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-success/10 text-success px-3 py-1 text-xs font-semibold">
                      <Zap className="size-3" /> 10 free AI calls — lifetime
                    </div>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2.5 flex-1">
                  {plan.features_list.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="size-4 text-success mt-0.5 shrink-0" />
                      <span className="text-foreground/80">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <Button size="lg" variant="outline" disabled className="w-full font-semibold">
                    Current Plan
                  </Button>
                ) : (
                  <Link
                    to="/billing"
                    search={{ plan: plan.slug }}
                    className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all ${
                      isPopular
                        ? "bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                        : "bg-card border border-primary/40 text-primary hover:bg-primary/10"
                    }`}
                  >
                    <Zap className="size-4" /> {isFree ? "Switch to" : "Upgrade to"} {plan.name}
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
          href="mailto:support@jancho.app"
          className="text-primary underline-offset-4 hover:underline"
        >
          Contact support
        </a>
      </p>
    </div>
  );
}
