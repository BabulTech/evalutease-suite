import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  HelpCircle,
  Users,
  PlayCircle,
  FileText,
  QrCode,
  Sparkles,
  ArrowRight,
  Activity,
  Zap,
  Star,
  Check,
  X,
  Coins,
  Wallet,
  Building2,
  Crown,
  TrendingUp,
  Clock,
  Send,
  ChevronRight,
  BarChart3,
  Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/contexts/PlanContext";
import { useHost, type HostInfo } from "@/contexts/HostContext";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

type Stats = {
  sessions: number;
  active: number;
  participants: number;
  questions: number;
};

type HostMemberInfo = HostInfo;

type CreditTx = {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
};

// ── Host Dashboard ─────────────────────────────────────────────────────────────
function HostDashboard({ host, userId }: { host: HostMemberInfo; userId: string }) {
  const [txs, setTxs] = useState<CreditTx[]>([]);
  const [stats, setStats] = useState({ sessions: 0, active: 0 });
  const [requesting, setRequesting] = useState(false);
  const [reqAmount, setReqAmount] = useState("");
  const [showReqForm, setShowReqForm] = useState(false);

  useEffect(() => {
    (async () => {
      const [txRes, sessRes, activeRes] = await Promise.all([
        (supabase as any).from("credit_transactions").select("id, amount, type, description, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(8),
        supabase.from("quiz_sessions").select("id", { count: "exact", head: true }).eq("owner_id", userId),
        supabase.from("quiz_sessions").select("id", { count: "exact", head: true }).eq("owner_id", userId).eq("status", "active"),
      ]);
      setTxs(txRes.data ?? []);
      setStats({ sessions: sessRes.count ?? 0, active: activeRes.count ?? 0 });
    })();
  }, [userId]);

  const creditsAvailable = host.balance;

  const handleRequestCredits = async () => {
    const amount = parseInt(reqAmount);
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    setRequesting(true);
    const { error } = await (supabase as any).from("credit_requests").insert({
      member_id: host.member_id,
      requester_user_id: userId,
      company_id: host.company_id,
      amount,
      note: null,
      status: "pending",
    });
    setRequesting(false);
    if (error) { toast.error(`Failed to send request: ${error.message}`); return; }
    toast.success("Credit request sent to your admin!");
    setShowReqForm(false);
    setReqAmount("");
  };

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Hero */}
      <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">{host.company_name}</span>
          </div>
          <h1 className="font-display text-2xl font-bold">Welcome back, {host.full_name.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your role: <span className="capitalize font-medium text-foreground">{host.role}</span></p>
        </div>
        <Link to="/sessions/new" className="w-full sm:w-auto">
          <Button className="h-12 w-full sm:w-auto px-6 bg-gradient-primary shadow-glow font-semibold text-base gap-2">
            <Plus size={18} /> Start Session
          </Button>
        </Link>
      </div>

      {/* Status strip */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl md:rounded-2xl border border-warning/30 bg-warning/5 p-3 sm:p-4 min-h-[92px]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Credits</div>
          <div className="font-display text-2xl font-bold text-warning mt-1">{creditsAvailable}</div>
          <div className="text-[10px] text-muted-foreground mt-1">of {host.total_earned} earned</div>
        </div>
        <Link to="/sessions" className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-3 sm:p-4 hover:border-primary/50 transition-all min-h-[92px]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sessions</div>
          <div className="font-display text-2xl font-bold mt-1">{stats.sessions}</div>
        </Link>
        <Link to="/sessions" className="rounded-xl md:rounded-2xl border border-success/20 bg-success/5 p-3 sm:p-4 hover:border-success/50 transition-all min-h-[92px]">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active</div>
          <div className="font-display text-2xl font-bold text-success mt-1">{stats.active}</div>
        </Link>
      </div>

      {/* Credits card */}
      <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-warning" />
          <h3 className="font-semibold text-sm">Credit Balance</h3>
          <span className="ml-auto text-xs text-muted-foreground">Earned +{host.total_earned} · Spent -{host.total_spent}</span>
        </div>
        {!showReqForm ? (
          <Button size="sm" variant="outline" className="gap-2 h-9" onClick={() => setShowReqForm(true)}>
            <Send className="h-3.5 w-3.5" /> Request More Credits
          </Button>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
            <input
              type="number"
              min={1}
              value={reqAmount}
              onChange={(e) => setReqAmount(e.target.value)}
              placeholder="Amount"
              className="h-10 w-28 rounded-lg border border-border bg-background px-3 text-sm"
            />
            <Button size="sm" onClick={handleRequestCredits} disabled={requesting} className="gap-1.5 bg-gradient-primary text-primary-foreground h-10">
              <Send className="h-3.5 w-3.5" /> {requesting ? "Sending…" : "Send"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowReqForm(false)} className="h-10">Cancel</Button>
          </div>
        )}
      </div>

      {/* Credit history */}
      <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Recent Transactions</h3>
        </div>
        {txs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
        ) : (
          <ul className="space-y-2">
            {txs.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between rounded-xl bg-secondary/30 px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium capitalize">{(tx.description ?? tx.type).replace(/_/g, " ")}</div>
                  <div className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</div>
                </div>
                <span className={`text-sm font-bold ${tx.amount > 0 ? "text-success" : tx.amount < 0 ? "text-destructive" : "text-muted-foreground"}`}>
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

// ── Status badge ────────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  active:    "bg-success/15 text-success",
  completed: "bg-primary/15 text-primary",
  scheduled: "bg-warning/15 text-warning",
  draft:     "bg-muted/40 text-muted-foreground",
};

// ── Main Dashboard ─────────────────────────────────────────────────────────────
function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { plan, loading: planLoading } = usePlan();
  const { hostInfo, loading: hostLoading } = useHost();
  const [upgradeBannerDismissed, setUpgradeBannerDismissed] = useState(
    () => sessionStorage.getItem("upgrade_banner_dismissed") === "1"
  );
  const [stats, setStats] = useState<Stats>({ sessions: 0, active: 0, participants: 0, questions: 0 });
  const [recent, setRecent] = useState<Array<{ id: string; title: string; status: string; created_at: string }>>([]);
  const [credits, setCredits] = useState<{ balance: number; total_earned: number; total_spent: number } | null>(null);

  // Greeting by time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.user_metadata?.first_name ?? user?.email?.split("@")[0] ?? "there";

  useEffect(() => {
    if (!user || hostLoading || hostInfo) return;
    (async () => {
      const [sess, active, parts, qs, recentSessions] = await Promise.all([
        supabase.from("quiz_sessions").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("quiz_sessions").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("status", "active"),
        supabase.from("participants").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("questions").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
        supabase.from("quiz_sessions").select("id, title, status, created_at").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(5),
      ]);
      setStats({
        sessions: sess.count ?? 0,
        active: active.count ?? 0,
        participants: parts.count ?? 0,
        questions: qs.count ?? 0,
      });
      setRecent(recentSessions.data ?? []);
      const creditsRow = await supabase.from("user_credits").select("balance, total_earned, total_spent").eq("user_id", user.id).maybeSingle();
      if (creditsRow.data) setCredits(creditsRow.data);
    })();
  }, [user, hostLoading, hostInfo]);

  const sessionLimit     = plan?.sessions_total ?? 20;
  const questionLimit    = plan?.question_bank ?? 100;
  const participantLimit = plan?.participants_per_session ?? 30;
  const isFreeTier = !planLoading && (!plan || plan.slug === "individual_starter");

  if (hostLoading) return null;
  if (hostInfo) return <HostDashboard host={hostInfo} userId={user!.id} />;

  // ── Limit helpers ──────────────────────────────────────────────────────────
  const limitPct = (used: number, limit: number) =>
    limit === -1 ? 0 : Math.min(100, Math.round((used / limit) * 100));

  const LimitBar = ({ used, limit }: { used: number; limit: number }) => {
    if (limit === -1) return <span className="text-[10px] text-muted-foreground">Unlimited</span>;
    const pct = limitPct(used, limit);
    const left = Math.max(0, limit - used);
    const danger = pct >= 80;
    return (
      <div className="space-y-1 mt-2">
        <div className={`text-[10px] font-medium ${danger ? "text-destructive" : "text-muted-foreground"}`}>
          {left} left of {limit}
        </div>
        <div className="h-1 rounded-full bg-muted/40 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${danger ? "bg-destructive" : "bg-primary/60"} ${
              pct <= 10 ? "w-[10%]" : pct <= 20 ? "w-1/5" : pct <= 25 ? "w-1/4" : pct <= 33 ? "w-1/3"
              : pct <= 40 ? "w-2/5" : pct <= 50 ? "w-1/2" : pct <= 60 ? "w-3/5" : pct <= 66 ? "w-2/3"
              : pct <= 75 ? "w-3/4" : pct <= 80 ? "w-4/5" : pct <= 90 ? "w-[90%]" : "w-full"
            }`}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 md:space-y-6">

      {/* ── 1. HERO: Greeting + Primary CTA ── */}
      <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{greeting},</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight truncate">{firstName} 👋</h1>
          {/* Plan + Credits inline — 2 pieces, not 2 sections */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {!planLoading && plan && (
              <Link
                to="/settings"
                search={{ tab: "plan" }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all hover:shadow-glow ${
                  plan.tier === "enterprise"
                    ? "border-warning/40 bg-warning/10 text-warning"
                    : plan.slug !== "individual_starter"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground"
                }`}
              >
                <Star className="h-3 w-3" />
                {plan.name}
              </Link>
            )}
            <Link
              to="/billing"
              search={{ plan: "" }}
              className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/5 px-3 py-1 text-xs font-semibold text-warning hover:bg-warning/10 transition-all"
            >
              <Coins className="h-3 w-3" />
              {credits?.balance ?? 0} credits
            </Link>
          </div>
        </div>
        {/* PRIMARY CTA — large, always visible (Fitts' Law) */}
        <Link to="/sessions/new" className="w-full sm:w-auto shrink-0">
          <Button className="h-12 w-full sm:w-auto px-6 bg-gradient-primary shadow-glow font-semibold text-base gap-2 hover:opacity-90 transition-opacity">
            <Plus size={18} /> Start New Session
          </Button>
        </Link>
      </div>

      {/* ── 2. STATUS STRIP — 3 key numbers (Hick's Law: not 4) ── */}
      <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-2 sm:gap-3">
        <Link
          to="/sessions"
          className="group rounded-xl md:rounded-2xl border border-success/20 bg-success/5 hover:border-success/50 hover:shadow-glow p-3 sm:p-4 transition-all min-h-[92px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active</span>
            <Activity className="h-4 w-4 text-success group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-success">{stats.active}</div>
          <div className="text-[10px] text-muted-foreground mt-1">live sessions</div>
        </Link>

        <Link
          to="/categories"
          className="group rounded-xl md:rounded-2xl border border-border bg-card/60 hover:border-primary/50 hover:shadow-glow p-3 sm:p-4 transition-all min-h-[92px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Questions</span>
            <HelpCircle className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold">{stats.questions}</div>
          <LimitBar used={stats.questions} limit={questionLimit} />
        </Link>

        <Link
          to="/participant-types"
          className="group rounded-xl md:rounded-2xl border border-border bg-card/60 hover:border-primary/50 hover:shadow-glow p-3 sm:p-4 transition-all min-h-[92px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Participants</span>
            <Users className="h-4 w-4 text-warning group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold">{stats.participants}</div>
          <LimitBar used={stats.participants} limit={participantLimit} />
        </Link>
      </div>

      {/* ── 3. RECENT SESSIONS — users' mental model: "what did I do last?" ── */}
      <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">{t("dash.recentSessions")}</h2>
          <Link to="/quiz-history" className="text-xs text-primary hover:underline flex items-center gap-1">
            {t("dash.viewAll")} <ChevronRight size={12} />
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <PlayCircle className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">No sessions yet</p>
            <Link to="/sessions/new">
              <Button size="sm" className="bg-gradient-primary shadow-glow gap-1.5">
                <Plus size={14} /> Create your first session
              </Button>
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  to="/sessions"
                  search={r.status === "active" || r.status === "scheduled" ? { lobby: r.id } : {}}
                  className="flex items-start sm:items-center justify-between rounded-xl bg-secondary/40 hover:bg-secondary/70 px-3 py-3 transition-all min-h-[56px] gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[r.status] ?? STATUS_STYLES.draft}`}>
                      {r.status}
                    </span>
                    {r.status === "active" && (
                      <span className="text-xs font-semibold text-success">Resume →</span>
                    )}
                    {r.status === "completed" && (
                      <span className="text-xs font-semibold text-primary">Results →</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── 4. SECONDARY ACTIONS — 4 tiles, 44px+ touch targets ── */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
          Quick Access
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {[
            { label: "Categories", desc: "Manage questions", to: "/categories" as const, icon: HelpCircle, color: "text-primary" },
            { label: "Participants", desc: "Manage groups", to: "/participant-types" as const, icon: Users, color: "text-warning" },
            { label: "Reports", desc: "View analytics", to: "/reports" as const, icon: BarChart3, color: "text-success" },
            { label: "All Sessions", desc: "Session history", to: "/quiz-history" as const, icon: FileText, color: "text-muted-foreground" },
          ].map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className="group rounded-xl md:rounded-2xl border border-border bg-card/40 hover:bg-card hover:border-primary/50 hover:shadow-glow p-3 sm:p-4 min-h-[86px] transition-all duration-200 flex flex-col justify-between"
            >
              <a.icon className={`h-5 w-5 ${a.color} group-hover:scale-110 transition-transform`} />
              <div>
                <div className="text-sm font-semibold leading-snug">{a.label}</div>
                <div className="text-[11px] text-muted-foreground">{a.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── 5. UPGRADE BANNER — free tier only, dismissible, at bottom ── */}
      {isFreeTier && !upgradeBannerDismissed && (
        <div className="relative rounded-xl md:rounded-2xl overflow-hidden border border-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-purple-500/10 p-4 md:p-5 flex flex-col sm:flex-row sm:items-center gap-4 shadow-glow">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
          <div className="relative rounded-2xl bg-gradient-primary p-3 shadow-glow shrink-0">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="relative flex-1 min-w-0">
            <div className="font-display font-bold text-base">{t("dash.freePlanBanner")}</div>
            <div className="text-sm text-muted-foreground mt-0.5">{t("dash.freePlanBannerDesc")}</div>
          </div>
          <div className="relative flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <Link to="/settings" search={{ tab: "plan" }} className="flex-1 sm:flex-none">
              <Button data-upgrade="true" className="h-10 w-full sm:w-auto bg-gradient-primary text-primary-foreground shadow-glow gap-1.5">
                <Star className="h-4 w-4" /> {t("dash.upgradeToPro")}
              </Button>
            </Link>
            <button
              type="button"
              title="Dismiss"
              onClick={() => { setUpgradeBannerDismissed(true); sessionStorage.setItem("upgrade_banner_dismissed", "1"); }}
              className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-muted/40 transition-colors text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
