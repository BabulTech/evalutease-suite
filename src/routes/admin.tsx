import React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, CreditCard, DollarSign, TrendingUp, Shield,
  Search, MoreHorizontal, Ban, CheckCircle, Edit2, ChevronUp, ChevronDown,
  Activity, BarChart3, BookOpen, Star, Zap, Building2, RefreshCw, Download,
  ArrowUpRight, ArrowDownRight, Calendar, Filter, UsersRound, FolderTree,
  PlayCircle, MessageSquare, AlertTriangle, Lightbulb, Bug, HelpCircle,
  Eye, Reply, X, ChevronRight, Globe, Clock, Trophy, Layers, Trash2, Plus,
  Tag, Percent, Hash, ToggleLeft, ToggleRight, Copy, Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { PaginationControls } from "@/components/PaginationControls";
import { usePaginationState } from "@/hooks/use-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

export const Route = createFileRoute("/admin")({ component: AdminPage });

// ─── helpers ────────────────────────────────────────────────
const fmt$ = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const ago = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
};

function planBadge(slug: string) {
  const cfg: Record<string, string> = {
    enterprise: "bg-warning/15 text-warning",
    pro: "bg-primary/15 text-primary",
    free: "bg-muted/40 text-muted-foreground",
  };
  return (
    <Badge className={`${cfg[slug] ?? cfg.free} border-0 text-[10px] capitalize`}>
      {slug === "enterprise" ? <Building2 className="h-3 w-3 mr-0.5 inline" /> :
       slug === "pro" ? <Star className="h-3 w-3 mr-0.5 inline" /> :
       <Zap className="h-3 w-3 mr-0.5 inline" />}
      {slug}
    </Badge>
  );
}
function statusBadge(s: string, map?: Record<string, string>) {
  const defaults: Record<string, string> = {
    active: "bg-success/15 text-success", completed: "bg-success/15 text-success",
    trialing: "bg-primary/15 text-primary", open: "bg-primary/15 text-primary",
    in_review: "bg-warning/15 text-warning", scheduled: "bg-warning/15 text-warning",
    canceled: "bg-muted/40 text-muted-foreground", expired: "bg-muted/40 text-muted-foreground",
    wont_fix: "bg-muted/40 text-muted-foreground",
    resolved: "bg-success/15 text-success", past_due: "bg-destructive/15 text-destructive",
    draft: "bg-muted/40 text-muted-foreground",
  };
  const cls = (map ?? defaults)[s] ?? "bg-muted/40 text-muted-foreground";
  return <Badge className={`${cls} border-0 text-[10px] capitalize`}>{s.replace("_", " ")}</Badge>;
}

// ─── stat card ──────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, trend, color = "text-primary" }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; trend?: number; color?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 hover:shadow-glow hover:scale-[1.02] hover:border-primary/40 transition-all duration-300 cursor-default">
      <div className="flex items-start justify-between">
        <div className="rounded-xl p-2.5 bg-primary/10">
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? "text-success" : "text-destructive"}`}>
            {trend >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="font-display text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ─── skeleton row ────────────────────────────────────────────
function SkeletonRows({ cols, n = 5 }: { cols: number; n?: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <tr key={i}>
          <td colSpan={cols} className="px-4 py-3">
            <div className="h-4 bg-muted/30 rounded animate-pulse" />
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── table shell ─────────────────────────────────────────────
function TableShell({ children, footer }: { children: React.ReactNode; footer?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
      {footer && (
        <div className="px-4 py-2.5 border-t border-border/40 bg-muted/10 text-xs text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  );
}
function THead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-border bg-muted/20 text-[11px] uppercase tracking-wider text-muted-foreground">
        {cols.map((c) => (
          <th key={c} className={`px-4 py-3 ${c === "" ? "" : "text-left"}`}>{c}</th>
        ))}
      </tr>
    </thead>
  );
}

// ─── nav item type ───────────────────────────────────────────
type NavItem = { key: string; label: string; icon: React.ElementType; badge?: number };

const NAV: NavItem[] = [
  { key: "overview",     label: "Overview",      icon: LayoutDashboard },
  { key: "users",        label: "Users",          icon: Users },
  { key: "participants", label: "Participants",    icon: UsersRound },
  { key: "quizzes",      label: "Quizzes",         icon: PlayCircle },
  { key: "categories",   label: "Categories",      icon: FolderTree },
  { key: "reviews",      label: "Reviews",         icon: Star },
  { key: "appfeedback",  label: "App Feedback",    icon: MessageSquare },
  { key: "plans",        label: "Plans",           icon: CreditCard },
  { key: "promocodes",   label: "Promo Codes",     icon: Tag },
  { key: "finance",      label: "Finance",         icon: DollarSign },
];

// ═══════════════════════════════════════════════════════════════
// MAIN ADMIN PAGE
// ═══════════════════════════════════════════════════════════════
function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [section, setSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [feedbackBadge, setFeedbackBadge] = useState(0);

  useEffect(() => {
    if (!user) { void navigate({ to: "/login" }); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => {
        if (!data) { toast.error("Access denied — admins only"); void navigate({ to: "/dashboard" }); }
        else setIsAdmin(true);
      });
    // count open app feedback
    supabase.from("app_feedback").select("id", { count: "exact", head: true }).eq("status", "open")
      .then(({ count }) => setFeedbackBadge(count ?? 0));
  }, [user, navigate]);

  if (isAdmin === null) return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm animate-pulse">
      Verifying admin access…
    </div>
  );

  const navItems: NavItem[] = NAV.map((n) =>
    n.key === "appfeedback" && feedbackBadge > 0 ? { ...n, badge: feedbackBadge } : n
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card/90 backdrop-blur sticky top-0 z-50 px-4 py-3 flex items-center gap-3 shrink-0">
        <button type="button" onClick={() => setSidebarOpen((v) => !v)}
          className="rounded-xl p-1.5 hover:bg-muted/40 transition-colors text-muted-foreground">
          <Layers className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-gradient-primary p-1.5 shadow-glow">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold">Admin Dashboard</span>
          <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">ADMIN</Badge>
        </div>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/dashboard" })}>
            ← Back to App
          </Button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? "w-52" : "w-14"} shrink-0 border-r border-border bg-card/60 transition-all duration-300 flex flex-col`}>
          <nav className="p-2 space-y-0.5 flex-1 overflow-y-auto">
            {navItems.map(({ key, label, icon: Icon, badge }) => (
              <button key={key} type="button" onClick={() => setSection(key)}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all ${
                  section === key
                    ? "bg-primary/15 text-primary border border-primary/25 shadow-glow"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}>
                <Icon className="h-4 w-4 shrink-0" />
                {sidebarOpen && (
                  <span className="font-medium truncate flex-1 text-left">{label}</span>
                )}
                {sidebarOpen && badge ? (
                  <span className="ml-auto rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center">
                    {badge}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5">
          {section === "overview"     && <OverviewSection onNavigate={setSection} />}
          {section === "users"        && <UsersSection />}
          {section === "participants" && <ParticipantsSection />}
          {section === "quizzes"      && <QuizzesSection />}
          {section === "categories"   && <CategoriesSection />}
          {section === "reviews"      && <ReviewsSection />}
          {section === "appfeedback"  && <AppFeedbackSection onCountChange={setFeedbackBadge} />}
          {section === "plans"        && <PlansSection />}
          {section === "promocodes"   && <PromoCodesSection />}
          {section === "finance"      && <FinanceSection />}
        </main>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// OVERVIEW
// ═══════════════════════════════════════════════════════════════
function OverviewSection({ onNavigate }: { onNavigate: (section: string) => void }) {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [recentUsers, setRecentUsers] = useState<{ name: string; email: string; plan: string; joined: string }[]>([]);
  const [recentQuizzes, setRecentQuizzes] = useState<{ title: string; owner: string; status: string; created: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const thisWeek = new Date(now.getTime() - 7 * 86400000).toISOString();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const since = dateFilter === "today" ? today : dateFilter === "week" ? thisWeek : dateFilter === "month" ? thisMonth : null;

      let sessQ = supabase.from("quiz_sessions").select("id", { count: "exact", head: true });
      let partsQ = supabase.from("participants").select("id", { count: "exact", head: true });
      let qsQ = supabase.from("questions").select("id", { count: "exact", head: true });
      if (since) { sessQ = sessQ.gte("created_at", since); partsQ = partsQ.gte("created_at", since); qsQ = qsQ.gte("created_at", since); }

      const [
        { count: c_users }, { count: c_sessions }, { count: c_questions },
        { count: c_participants }, { count: c_categories }, { count: c_feedback },
        { count: c_active_subs }, { count: c_new_users },
        { data: payments }, { data: profiles }, { data: sessions },
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        sessQ,
        qsQ,
        partsQ,
        supabase.from("question_categories").select("id", { count: "exact", head: true }),
        supabase.from("quiz_feedback").select("id", { count: "exact", head: true }),
        supabase.from("user_subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", thisMonth),
        supabase.from("payment_history").select("amount_cents").eq("status", "paid"),
        supabase.from("profiles").select("id, full_name, email, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("quiz_sessions").select("id, title, owner_id, status, created_at").order("created_at", { ascending: false }).limit(5),
      ]);

      const revenue = (payments ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);
      setStats({
        users: c_users ?? 0, sessions: c_sessions ?? 0, questions: c_questions ?? 0,
        participants: c_participants ?? 0, categories: c_categories ?? 0,
        feedback: c_feedback ?? 0, active_subs: c_active_subs ?? 0,
        new_users: c_new_users ?? 0, revenue,
      });

      // enrich with plan
      const ids = (profiles ?? []).map((p) => p.id);
      const { data: subs } = await supabase.from("user_subscriptions").select("user_id, plans(slug)").in("user_id", ids);
      const planMap: Record<string, string> = {};
      (subs ?? []).forEach((s) => { planMap[s.user_id] = (s.plans as { slug: string } | null)?.slug ?? "free"; });
      setRecentUsers((profiles ?? []).map((p) => ({
        name: p.full_name ?? "—", email: p.email ?? "—",
        plan: planMap[p.id] ?? "free", joined: p.created_at,
      })));

      // enrich quizzes with owner name
      const ownerIds = [...new Set((sessions ?? []).map((s) => s.owner_id))];
      const { data: owners } = await supabase.from("profiles").select("id, full_name").in("id", ownerIds);
      const ownerMap: Record<string, string> = {};
      (owners ?? []).forEach((o) => { ownerMap[o.id] = o.full_name ?? "—"; });
      setRecentQuizzes((sessions ?? []).map((s) => ({
        title: s.title, owner: ownerMap[s.owner_id] ?? "—",
        status: s.status, created: s.created_at,
      })));

      setLoading(false);
    })();
  }, [dateFilter]);

  // filter recentUsers by plan
  const filteredRecentUsers = planFilter === "all" ? recentUsers : recentUsers.filter((u) => u.plan === planFilter);

  if (loading) return <div className="grid grid-cols-3 gap-4">{Array.from({length:9}).map((_,i)=><div key={i} className="h-28 rounded-2xl bg-muted/30 animate-pulse" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHead title="Platform Overview" sub="Real-time snapshot of the entire platform." />
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-36 h-8 text-xs"><Calendar className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">This month</SelectItem>
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-32 h-8 text-xs"><Filter className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <button type="button" onClick={() => onNavigate("users")} className="text-left">
          <StatCard label="Total Hosts" value={stats.users} icon={Users} trend={12} />
        </button>
        <button type="button" onClick={() => onNavigate("participants")} className="text-left">
          <StatCard label="Total Participants" value={stats.participants} icon={UsersRound} color="text-success" />
        </button>
        <button type="button" onClick={() => onNavigate("quizzes")} className="text-left">
          <StatCard label="Quiz Sessions" value={stats.sessions} icon={PlayCircle} />
        </button>
        <button type="button" onClick={() => onNavigate("categories")} className="text-left">
          <StatCard label="Questions" value={stats.questions} icon={BookOpen} />
        </button>
        <button type="button" onClick={() => onNavigate("categories")} className="text-left">
          <StatCard label="Categories" value={stats.categories} icon={FolderTree} />
        </button>
        <button type="button" onClick={() => onNavigate("reviews")} className="text-left">
          <StatCard label="Student Reviews" value={stats.feedback} icon={Star} color="text-warning" />
        </button>
        <button type="button" onClick={() => onNavigate("plans")} className="text-left">
          <StatCard label="Active Subscriptions" value={stats.active_subs} icon={CreditCard} color="text-primary" trend={8} />
        </button>
        <button type="button" onClick={() => onNavigate("finance")} className="text-left">
          <StatCard label="Revenue" value={fmt$(stats.revenue)} icon={DollarSign} color="text-warning" />
        </button>
        <button type="button" onClick={() => onNavigate("users")} className="text-left">
          <StatCard label="New Hosts (Month)" value={stats.new_users} icon={TrendingUp} color="text-success" trend={stats.new_users > 0 ? 15 : 0} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent signups */}
        <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
          <div className="px-5 py-3 border-b border-border/60 bg-muted/20 flex items-center justify-between">
            <span className="font-semibold text-sm">Recent Host Signups</span>
            <button type="button" onClick={() => onNavigate("users")} className="text-[11px] text-primary hover:underline">View all</button>
          </div>
          <div className="divide-y divide-border/40">
            {filteredRecentUsers.map((u, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/10">
                <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{u.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{u.email}</div>
                </div>
                {planBadge(u.plan)}
                <span className="text-[11px] text-muted-foreground shrink-0">{ago(u.joined)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent quizzes */}
        <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
          <div className="px-5 py-3 border-b border-border/60 bg-muted/20 flex items-center justify-between">
            <span className="font-semibold text-sm">Recent Quiz Sessions</span>
            <button type="button" onClick={() => onNavigate("quizzes")} className="text-[11px] text-primary hover:underline">View all</button>
          </div>
          <div className="divide-y divide-border/40">
            {recentQuizzes.map((q, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/10">
                <div className="h-8 w-8 rounded-xl bg-muted/40 flex items-center justify-center shrink-0">
                  <PlayCircle className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{q.title}</div>
                  <div className="text-[11px] text-muted-foreground">by {q.owner}</div>
                </div>
                {statusBadge(q.status)}
                <span className="text-[11px] text-muted-foreground shrink-0">{ago(q.created)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// USER DETAIL PANEL
// ═══════════════════════════════════════════════════════════════
type UserRow = {
  id: string; full_name: string | null; email: string | null;
  organization: string | null; country: string | null; mobile: string | null;
  created_at: string; plan_slug: string; sub_status: string;
  session_count: number; question_count: number; participant_count: number;
};

function UserDetailPanel({ user, onChangePlan }: { user: UserRow; onChangePlan: (userId: string, slug: string) => void }) {
  const [subDetails, setSubDetails] = useState<{
    plan_name: string; status: string; started_at: string | null;
    expires_at: string | null; stripe_customer_id: string | null;
    plan_limits: Record<string, number>;
    plan_features: string[];
  } | null>(null);
  const [payments, setPayments] = useState<{ amount_cents: number; status: string; created_at: string; description: string | null }[]>([]);
  const [recentSessions, setRecentSessions] = useState<{ id: string; title: string; status: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [subRes, payRes, sessRes] = await Promise.all([
        supabase.from("user_subscriptions").select("*, plans(name, limits, features)").eq("user_id", user.id).maybeSingle(),
        supabase.from("payment_history").select("amount_cents, status, paid_at, description").eq("user_id", user.id).order("paid_at", { ascending: false }).limit(5),
        supabase.from("quiz_sessions").select("id, title, status, created_at").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(5),
      ]);
      if (subRes.data) {
        const raw = subRes.data as unknown as Record<string, unknown>;
        const plan = (raw.plans ?? null) as Record<string, unknown> | null;
        setSubDetails({
          plan_name: (plan?.name as string) ?? user.plan_slug,
          status: (raw.status as string) ?? "—",
          started_at: (raw.current_period_start as string | null) ?? null,
          expires_at: (raw.current_period_end as string | null) ?? null,
          stripe_customer_id: (raw.stripe_customer_id as string | null) ?? null,
          plan_limits: (plan?.limits as Record<string, number>) ?? {},
          plan_features: (plan?.features as string[]) ?? [],
        });
      }
      const pays = (payRes.data ?? []) as unknown as { amount_cents: number; status: string; created_at: string; description: string | null }[];
      setPayments(pays);
      setRecentSessions(sessRes.data ?? []);
      setLoading(false);
    })();
  }, [user.id]);

  const limitLabels: Record<string, string> = {
    quizzes_per_day: "Quizzes / day",
    ai_calls_per_day: "AI calls / day",
    participants_per_session: "Participants / session",
    question_bank: "Question bank",
    sessions_total: "Total sessions",
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-primary/15 flex items-center justify-center text-primary font-bold text-2xl shrink-0">
          {(user.full_name ?? user.email ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-lg">{user.full_name ?? "—"}</div>
          <div className="text-sm text-muted-foreground">{user.email ?? "—"}</div>
          <div className="flex items-center gap-2 mt-1">
            {planBadge(user.plan_slug)}
            {statusBadge(user.sub_status)}
          </div>
        </div>
      </div>

      {/* Consumer / Profile details */}
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Profile Details</div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Organization", user.organization],
            ["Country", user.country],
            ["Mobile", user.mobile],
            ["Joined", fmtDate(user.created_at)],
          ].map(([l, v]) => (
            <div key={l} className="space-y-0.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{l}</div>
              <div className="text-xs font-medium">{v ?? "—"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Usage stats */}
      <div className="grid grid-cols-3 gap-3">
        {([["Sessions", user.session_count, PlayCircle], ["Questions", user.question_count, BookOpen], ["Participants", user.participant_count, UsersRound]] as [string, number, React.ElementType][]).map(([l, v, Icon]) => (
          <div key={l} className="rounded-xl border border-border bg-card/40 p-3 text-center">
            <Icon className="h-4 w-4 text-primary mx-auto mb-1" />
            <div className="font-display text-xl font-bold text-primary">{v}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{l}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2].map((i) => <div key={i} className="h-20 rounded-xl bg-muted/30 animate-pulse" />)}</div>
      ) : (
        <>
          {/* Subscription details */}
          {subDetails && (
            <div className="rounded-xl border border-primary/30 bg-card/40 p-4 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subscription</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Plan", subDetails.plan_name],
                  ["Status", subDetails.status],
                  ["Started", subDetails.started_at ? fmtDate(subDetails.started_at) : "—"],
                  ["Expires", subDetails.expires_at ? fmtDate(subDetails.expires_at) : "—"],
                ].map(([l, v]) => (
                  <div key={l} className="space-y-0.5">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{l}</div>
                    <div className="text-xs font-medium capitalize">{v ?? "—"}</div>
                  </div>
                ))}
              </div>
              {subDetails.stripe_customer_id && (
                <div className="pt-1 border-t border-border/40">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Stripe Customer ID</div>
                  <div className="text-xs font-mono text-muted-foreground">{subDetails.stripe_customer_id}</div>
                </div>
              )}
              {/* Plan limits */}
              {Object.keys(subDetails.plan_limits).length > 0 && (
                <div className="pt-1 border-t border-border/40 space-y-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Plan Limits</div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(subDetails.plan_limits).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{limitLabels[k] ?? k}</span>
                        <span className="font-semibold">{v === -1 ? "∞" : v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment history */}
          {payments.length > 0 && (
            <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment History</div>
              <div className="divide-y divide-border/40">
                {payments.map((p, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium">{p.description ?? "Payment"}</div>
                      <div className="text-muted-foreground">{fmtDate(p.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{fmt$(p.amount_cents)}</span>
                      {statusBadge(p.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent sessions */}
          {recentSessions.length > 0 && (
            <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Quiz Sessions</div>
              <div className="divide-y divide-border/40">
                {recentSessions.map((s) => (
                  <div key={s.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                    <div className="font-medium truncate max-w-48">{s.title}</div>
                    <div className="flex items-center gap-2 shrink-0">
                      {statusBadge(s.status)}
                      <span className="text-muted-foreground">{fmtDateShort(s.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Change plan */}
      <div className="rounded-xl border border-border bg-card/40 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Change Plan</div>
        <div className="flex gap-2">
          {["free","pro","enterprise"].map((s) => (
            <button key={s} type="button"
              onClick={() => onChangePlan(user.id, s)}
              className={`flex-1 text-xs py-2 rounded-xl border font-medium transition-colors capitalize ${user.plan_slug === s ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// USERS (HOSTS)
// ═══════════════════════════════════════════════════════════════
function UsersSection() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [detail, setDetail] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles")
      .select("id,full_name,email,organization,country,mobile,created_at")
      .order("created_at", { ascending: false });
    if (!profiles?.length) { setLoading(false); return; }
    const ids = profiles.map((p) => p.id);

    const [{ data: subs }, { data: sess }, { data: qs }, { data: parts }] = await Promise.all([
      supabase.from("user_subscriptions").select("user_id,status,plans(slug)").in("user_id", ids),
      supabase.from("quiz_sessions").select("owner_id").in("owner_id", ids),
      supabase.from("questions").select("owner_id").in("owner_id", ids),
      supabase.from("participants").select("owner_id").in("owner_id", ids),
    ]);

    const subMap: Record<string, { slug: string; status: string }> = {};
    (subs ?? []).forEach((s) => {
      subMap[s.user_id] = { slug: (s.plans as { slug: string } | null)?.slug ?? "free", status: s.status };
    });
    const cnt = (arr: { owner_id?: string }[] | null, id: string) =>
      (arr ?? []).filter((x) => x.owner_id === id).length;

    setRows(profiles.map((p) => ({
      ...p, plan_slug: subMap[p.id]?.slug ?? "free", sub_status: subMap[p.id]?.status ?? "active",
      session_count: cnt(sess, p.id), question_count: cnt(qs, p.id), participant_count: cnt(parts, p.id),
    })));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const changePlan = async (userId: string, slug: string) => {
    const { data: plan } = await supabase.from("plans").select("id").eq("slug", slug).maybeSingle();
    if (!plan) return;
    await supabase.from("user_subscriptions").upsert({ user_id: userId, plan_id: plan.id, status: "active" }, { onConflict: "user_id" });
    toast.success("Plan updated");
    void load();
  };

  const filtered = useMemo(() => {
    let r = rows;
    if (search) { const q = search.toLowerCase(); r = r.filter((u) => [u.full_name, u.email, u.organization].some((v) => v?.toLowerCase().includes(q))); }
    if (planFilter !== "all") r = r.filter((u) => u.plan_slug === planFilter);
    return r;
  }, [rows, search, planFilter]);

  // ── Detail page view ──────────────────────────────────────────
  if (detail) {
    return (
      <div className="space-y-5">
        {/* Back bar */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDetail(null)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl px-3 py-1.5 hover:bg-muted/40"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            Back to Users
          </button>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm font-medium truncate">{detail.full_name ?? detail.email ?? "User"}</span>
        </div>

        <UserDetailPanel user={detail} onChangePlan={changePlan} />
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <SectionHead title="Hosts & Teachers" sub={`${rows.length} registered hosts on the platform.`} />
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, email, org…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-36"><Filter className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5"><RefreshCw className="h-4 w-4" />Refresh</Button>
      </div>

      <TableShell footer={`${filtered.length} of ${rows.length} hosts`}>
        <THead cols={["Host", "Org / Country", "Plan", "Sessions", "Questions", "Participants", "Joined", ""]} />
        <tbody className="divide-y divide-border/40">
          {loading ? <SkeletonRows cols={8} /> : filtered.length === 0 ? (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No hosts found.</td></tr>
          ) : filtered.map((u) => (
            <tr key={u.id} className="hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => setDetail(u)}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                    {(u.full_name ?? u.email ?? "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-medium">{u.full_name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{u.email ?? "—"}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{[u.organization, u.country].filter(Boolean).join(" · ") || "—"}</td>
              <td className="px-4 py-3">{planBadge(u.plan_slug)}</td>
              <td className="px-4 py-3 text-xs font-medium text-center">{u.session_count}</td>
              <td className="px-4 py-3 text-xs font-medium text-center">{u.question_count}</td>
              <td className="px-4 py-3 text-xs font-medium text-center">{u.participant_count}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(u.created_at)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  {["free","pro","enterprise"].map((s) => (
                    <button key={s} type="button" title={`Set ${s}`}
                      onClick={() => void changePlan(u.id, s)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${u.plan_slug === s ? "bg-primary/20 border-primary/30 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PARTICIPANTS
// ═══════════════════════════════════════════════════════════════
function ParticipantsSection() {
  type Row = {
    id: string; name: string; email: string | null; mobile: string | null;
    owner_name: string; subtype: string; created_at: string;
    attempt_count: number; avg_score: number;
  };
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<"created_at" | "name">("created_at");
  const { page, pageSize, setPage, setPageSize } = usePaginationState(25);
  const debouncedSearch = useDebouncedValue(search, 250);

  const loadParticipants = useCallback(async () => {
    setLoading(true);
    const offset = page * pageSize;
    const searchTerm = debouncedSearch.trim();
    let query = supabase
      .from("participants")
      .select("id,name,email,mobile,owner_id,subtype_id,created_at", { count: "exact" });
    if (searchTerm) {
      query = query.or(
        `name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,mobile.ilike.%${searchTerm}%`,
      );
    }
    query = sort === "name"
      ? query.order("name", { ascending: true })
      : query.order("created_at", { ascending: false });

    const { data: parts, count } = await query.range(offset, offset + pageSize - 1);
    setTotal(count ?? 0);
    if (!parts?.length) {
      setRows([]);
      setLoading(false);
      return;
    }

    const ownerIds = [...new Set(parts.map((p) => p.owner_id))];
    const subtypeIds = [...new Set(parts.map((p) => p.subtype_id).filter(Boolean))] as string[];
    const partIds = parts.map((p) => p.id);

    const [{ data: owners }, { data: subtypes }, { data: attempts }] = await Promise.all([
      supabase.from("profiles").select("id,full_name").in("id", ownerIds),
      subtypeIds.length
        ? supabase.from("participant_subtypes").select("id,name").in("id", subtypeIds)
        : Promise.resolve({ data: [] }),
      supabase.from("quiz_attempts")
        .select("participant_id,score,total_questions,completed_at")
        .in("participant_id", partIds)
        .not("completed_at", "is", null),
    ]);

    const ownerMap: Record<string, string> = {};
    (owners ?? []).forEach((o) => { ownerMap[o.id] = o.full_name ?? "—"; });
    const subMap: Record<string, string> = {};
    (subtypes ?? []).forEach((s) => { subMap[s.id] = s.name; });

    const attemptMap: Record<string, { count: number; totalPct: number }> = {};
    (attempts ?? []).forEach((a) => {
      if (!a.participant_id) return;
      const pct = a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0;
      if (!attemptMap[a.participant_id]) attemptMap[a.participant_id] = { count: 0, totalPct: 0 };
      attemptMap[a.participant_id].count++;
      attemptMap[a.participant_id].totalPct += pct;
    });

    setRows(parts.map((p) => ({
      id: p.id, name: p.name, email: p.email, mobile: p.mobile,
      owner_name: ownerMap[p.owner_id] ?? "—",
      subtype: p.subtype_id ? (subMap[p.subtype_id] ?? "—") : "—",
      created_at: p.created_at,
      attempt_count: attemptMap[p.id]?.count ?? 0,
      avg_score: attemptMap[p.id]
        ? Math.round(attemptMap[p.id].totalPct / attemptMap[p.id].count)
        : 0,
    })));
    setLoading(false);
  }, [debouncedSearch, page, pageSize, sort]);

  useEffect(() => {
    void loadParticipants();
  }, [loadParticipants]);

  return (
    <div className="space-y-4">
      <SectionHead title="Participants" sub={`${total} participants across all hosts.`} />
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, mobile…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sort} onValueChange={(value) => setSort(value as "created_at" | "name")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Newest added</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <TableShell>
        <THead cols={["Participant", "Host", "Group", "Quizzes Taken", "Avg Score", "Added"]} />
        <tbody className="divide-y divide-border/40">
          {loading ? <SkeletonRows cols={6} /> : rows.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No participants found.</td></tr>
          ) : rows.map((r) => (
            <tr key={r.id} className="hover:bg-muted/10 transition-colors">
              <td className="px-4 py-3">
                <div className="text-xs font-medium">{r.name}</div>
                <div className="text-[11px] text-muted-foreground">{r.email ?? r.mobile ?? "—"}</div>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{r.owner_name}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{r.subtype}</td>
              <td className="px-4 py-3 text-xs font-medium text-center">{r.attempt_count}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Progress value={r.avg_score} className="h-1.5 w-16" />
                  <span className={`text-xs font-semibold ${r.avg_score >= 70 ? "text-success" : r.avg_score >= 40 ? "text-warning" : "text-destructive"}`}>
                    {r.attempt_count > 0 ? `${r.avg_score}%` : "—"}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDateShort(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </TableShell>
      <PaginationControls
        page={page}
        pageSize={pageSize}
        total={total}
        label="participants"
        onPageChange={setPage}
        pageSizeOptions={[25, 50, 100]}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// QUIZZES
// ═══════════════════════════════════════════════════════════════
function QuizzesSection() {
  type Row = {
    id: string; title: string; status: string; mode: string; topic: string | null;
    owner_name: string; owner_email: string;
    q_count: number; attempt_count: number; avg_score: number;
    created_at: string; started_at: string | null;
  };
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: sessions } = await supabase.from("quiz_sessions")
        .select("id,title,status,mode,topic,owner_id,created_at,started_at")
        .order("created_at", { ascending: false }).limit(300);
      if (!sessions?.length) { setLoading(false); return; }

      const ownerIds = [...new Set(sessions.map((s) => s.owner_id))];
      const sessIds = sessions.map((s) => s.id);

      const [{ data: owners }, { data: qLinks }, { data: attempts }] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email").in("id", ownerIds),
        supabase.from("quiz_session_questions").select("session_id").in("session_id", sessIds),
        supabase.from("quiz_attempts").select("session_id,score,total_questions,completed_at")
          .in("session_id", sessIds).not("completed_at", "is", null),
      ]);

      const ownerMap: Record<string, { name: string; email: string }> = {};
      (owners ?? []).forEach((o) => { ownerMap[o.id] = { name: o.full_name ?? "—", email: o.email ?? "—" }; });

      const qMap: Record<string, number> = {};
      (qLinks ?? []).forEach((q) => { qMap[q.session_id] = (qMap[q.session_id] ?? 0) + 1; });

      const attMap: Record<string, { count: number; totalPct: number }> = {};
      (attempts ?? []).forEach((a) => {
        const pct = a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0;
        if (!attMap[a.session_id]) attMap[a.session_id] = { count: 0, totalPct: 0 };
        attMap[a.session_id].count++;
        attMap[a.session_id].totalPct += pct;
      });

      setRows(sessions.map((s) => ({
        id: s.id, title: s.title, status: s.status, mode: s.mode, topic: s.topic,
        owner_name: ownerMap[s.owner_id]?.name ?? "—", owner_email: ownerMap[s.owner_id]?.email ?? "—",
        q_count: qMap[s.id] ?? 0,
        attempt_count: attMap[s.id]?.count ?? 0,
        avg_score: attMap[s.id] ? Math.round(attMap[s.id].totalPct / attMap[s.id].count) : 0,
        created_at: s.created_at, started_at: s.started_at,
      })));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let r = rows;
    if (search) { const q = search.toLowerCase(); r = r.filter((x) => [x.title, x.owner_name, x.topic].some((v) => v?.toLowerCase().includes(q))); }
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    return r;
  }, [rows, search, statusFilter]);

  return (
    <div className="space-y-4">
      <SectionHead title="Quiz Sessions" sub={`${rows.length} sessions created across all hosts.`} />
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search title, host, type…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["draft","scheduled","active","completed","expired"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <TableShell footer={`${filtered.length} of ${rows.length} sessions`}>
        <THead cols={["Quiz Title", "Host", "Type", "Status", "Questions", "Attempts", "Avg Score", "Created"]} />
        <tbody className="divide-y divide-border/40">
          {loading ? <SkeletonRows cols={8} /> : filtered.length === 0 ? (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No sessions found.</td></tr>
          ) : filtered.map((r) => (
            <tr key={r.id} className="hover:bg-muted/10 transition-colors">
              <td className="px-4 py-3">
                <div className="text-xs font-medium max-w-[180px] truncate">{r.title}</div>
                <div className="text-[11px] text-muted-foreground capitalize">{r.mode.replace("_", " ")}</div>
              </td>
              <td className="px-4 py-3">
                <div className="text-xs font-medium">{r.owner_name}</div>
                <div className="text-[11px] text-muted-foreground">{r.owner_email}</div>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{r.topic ?? "—"}</td>
              <td className="px-4 py-3">{statusBadge(r.status)}</td>
              <td className="px-4 py-3 text-xs font-medium text-center">{r.q_count}</td>
              <td className="px-4 py-3 text-xs font-medium text-center">{r.attempt_count}</td>
              <td className="px-4 py-3">
                {r.attempt_count > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <Progress value={r.avg_score} className="h-1.5 w-12" />
                    <span className={`text-xs font-semibold ${r.avg_score >= 70 ? "text-success" : r.avg_score >= 40 ? "text-warning" : "text-destructive"}`}>{r.avg_score}%</span>
                  </div>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDateShort(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════
function CategoriesSection() {
  type Row = {
    id: string; name: string; subject: string | null; icon: string | null;
    owner_name: string; sub_count: number; question_count: number; created_at: string;
  };
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: cats } = await supabase.from("question_categories")
        .select("id,name,subject,icon,owner_id,created_at").order("created_at", { ascending: false });
      if (!cats?.length) { setLoading(false); return; }

      const ownerIds = [...new Set(cats.map((c) => c.owner_id))];
      const catIds = cats.map((c) => c.id);

      const [{ data: owners }, { data: subs }, { data: qs }] = await Promise.all([
        supabase.from("profiles").select("id,full_name").in("id", ownerIds),
        supabase.from("question_subcategories").select("category_id").in("category_id", catIds),
        supabase.from("questions").select("category_id").in("category_id", catIds),
      ]);

      const ownerMap: Record<string, string> = {};
      (owners ?? []).forEach((o) => { ownerMap[o.id] = o.full_name ?? "—"; });
      const subCnt: Record<string, number> = {};
      (subs ?? []).forEach((s) => { subCnt[s.category_id] = (subCnt[s.category_id] ?? 0) + 1; });
      const qCnt: Record<string, number> = {};
      (qs ?? []).forEach((q) => { if (q.category_id) qCnt[q.category_id] = (qCnt[q.category_id] ?? 0) + 1; });

      setRows(cats.map((c) => ({
        id: c.id, name: c.name, subject: c.subject, icon: c.icon,
        owner_name: ownerMap[c.owner_id] ?? "—",
        sub_count: subCnt[c.id] ?? 0, question_count: qCnt[c.id] ?? 0,
        created_at: c.created_at,
      })));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => [r.name, r.subject, r.owner_name].some((v) => v?.toLowerCase().includes(q)));
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <SectionHead title="Question Categories" sub={`${rows.length} categories created by hosts.`} />
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search name, subject, host…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <TableShell footer={`${filtered.length} of ${rows.length} categories`}>
        <THead cols={["Category", "Subject", "Owner", "Subcategories", "Questions", "Created"]} />
        <tbody className="divide-y divide-border/40">
          {loading ? <SkeletonRows cols={6} /> : filtered.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No categories found.</td></tr>
          ) : filtered.map((r) => (
            <tr key={r.id} className="hover:bg-muted/10 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">{r.icon ?? "📁"}</span>
                  <span className="text-xs font-medium">{r.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{r.subject ?? "—"}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{r.owner_name}</td>
              <td className="px-4 py-3 text-xs font-medium text-center">{r.sub_count}</td>
              <td className="px-4 py-3 text-xs font-medium text-center">{r.question_count}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDateShort(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STUDENT REVIEWS (quiz_feedback)
// ═══════════════════════════════════════════════════════════════
function ReviewsSection() {
  type Row = {
    id: string; session_title: string; host_name: string; host_email: string;
    participant_name: string; participant_email: string | null;
    rating: number; comment: string | null; submitted_at: string;
  };
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: feedback } = await supabase.from("quiz_feedback")
        .select("id,session_id,participant_name,participant_email,rating,comment,submitted_at")
        .order("submitted_at", { ascending: false }).limit(300);
      if (!feedback?.length) { setLoading(false); return; }

      const sessIds = [...new Set(feedback.map((f) => f.session_id))];
      const { data: sessions } = await supabase.from("quiz_sessions")
        .select("id,title,owner_id").in("id", sessIds);

      const ownerIds = [...new Set((sessions ?? []).map((s) => s.owner_id))];
      const { data: owners } = await supabase.from("profiles").select("id,full_name,email").in("id", ownerIds);

      const sessMap: Record<string, { title: string; owner_id: string }> = {};
      (sessions ?? []).forEach((s) => { sessMap[s.id] = { title: s.title, owner_id: s.owner_id }; });
      const ownerMap: Record<string, { name: string; email: string }> = {};
      (owners ?? []).forEach((o) => { ownerMap[o.id] = { name: o.full_name ?? "—", email: o.email ?? "—" }; });

      setRows(feedback.map((f) => {
        const sess = sessMap[f.session_id];
        const owner = sess ? (ownerMap[sess.owner_id] ?? { name: "—", email: "—" }) : { name: "—", email: "—" };
        return {
          id: f.id, session_title: sess?.title ?? "—",
          host_name: owner.name, host_email: owner.email,
          participant_name: f.participant_name, participant_email: f.participant_email,
          rating: f.rating, comment: f.comment, submitted_at: f.submitted_at,
        };
      }));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let r = rows;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((x) => [x.session_title, x.host_name, x.participant_name, x.comment].some((v) => v?.toLowerCase().includes(q)));
    }
    if (ratingFilter !== "all") r = r.filter((x) => String(x.rating) === ratingFilter);
    return r;
  }, [rows, search, ratingFilter]);

  const avg = rows.length ? (rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(1) : "—";
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, cnt: rows.filter((r) => r.rating === n).length }));

  return (
    <div className="space-y-4">
      <SectionHead title="Student Reviews" sub="Feedback submitted by participants after completing quizzes." />

      {/* Summary */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-card/60 p-5 flex items-center gap-5">
            <div className="text-center">
              <div className="font-display text-5xl font-bold text-warning">{avg}</div>
              <div className="flex gap-0.5 mt-1 justify-center">
                {Array.from({length:5}).map((_,i)=>(
                  <Star key={i} className={`h-3.5 w-3.5 ${i < Math.round(Number(avg)) ? "text-warning fill-warning" : "text-muted-foreground"}`} />
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{rows.length} reviews</div>
            </div>
            <div className="flex-1 space-y-1">
              {dist.map(({ n, cnt }) => (
                <div key={n} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-muted-foreground text-right">{n}</span>
                  <div className="flex-1 rounded-full bg-muted/30 h-1.5">
                    <div className="h-full rounded-full bg-warning" style={{ width: rows.length ? `${(cnt / rows.length) * 100}%` : "0%" }} />
                  </div>
                  <span className="text-muted-foreground w-5 text-right">{cnt}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-2">
            <div className="text-sm font-semibold mb-3">Top Hosts by Reviews</div>
            {Object.entries(
              rows.reduce((acc, r) => { acc[r.host_name] = (acc[r.host_name] ?? 0) + 1; return acc; }, {} as Record<string, number>)
            ).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, cnt]) => (
              <div key={name} className="flex items-center gap-2 text-xs">
                <span className="flex-1 truncate text-muted-foreground">{name}</span>
                <span className="font-semibold">{cnt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search quiz, host, participant…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ratings</SelectItem>
            {[5,4,3,2,1].map((n)=><SelectItem key={n} value={String(n)}>{"★".repeat(n)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <TableShell footer={`${filtered.length} of ${rows.length} reviews`}>
        <THead cols={["Quiz / Host", "Participant", "Rating", "Comment", "Date"]} />
        <tbody className="divide-y divide-border/40">
          {loading ? <SkeletonRows cols={5} /> : filtered.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">No reviews yet.</td></tr>
          ) : filtered.map((r) => (
            <tr key={r.id} className="hover:bg-muted/10 transition-colors">
              <td className="px-4 py-3">
                <div className="text-xs font-medium max-w-[160px] truncate">{r.session_title}</div>
                <div className="text-[11px] text-muted-foreground">{r.host_name}</div>
              </td>
              <td className="px-4 py-3">
                <div className="text-xs font-medium">{r.participant_name}</div>
                <div className="text-[11px] text-muted-foreground">{r.participant_email ?? "—"}</div>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-0.5">
                  {Array.from({length:5}).map((_,i)=>(
                    <Star key={i} className={`h-3 w-3 ${i < r.rating ? "text-warning fill-warning" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px]">
                {r.comment ? <span className="line-clamp-2">{r.comment}</span> : <span className="italic">No comment</span>}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDateShort(r.submitted_at)}</td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// APP FEEDBACK (teacher → admin)
// ═══════════════════════════════════════════════════════════════
function AppFeedbackSection({ onCountChange }: { onCountChange: (n: number) => void }) {
  type Row = {
    id: string; user_name: string; user_email: string;
    type: string; title: string; body: string;
    status: string; priority: string; admin_reply: string | null; created_at: string;
  };
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Row | null>(null);
  const [replyText, setReplyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("app_feedback")
      .select("id,user_id,type,title,body,status,priority,admin_reply,created_at")
      .order("created_at", { ascending: false });
    if (!data?.length) { setLoading(false); return; }

    const userIds = [...new Set(data.map((d) => d.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("id,full_name,email").in("id", userIds);
    const profMap: Record<string, { name: string; email: string }> = {};
    (profiles ?? []).forEach((p) => { profMap[p.id] = { name: p.full_name ?? "—", email: p.email ?? "—" }; });

    const enriched = data.map((d) => ({
      id: d.id, user_name: profMap[d.user_id]?.name ?? "—", user_email: profMap[d.user_id]?.email ?? "—",
      type: d.type, title: d.title, body: d.body,
      status: d.status, priority: d.priority, admin_reply: d.admin_reply, created_at: d.created_at,
    }));
    setRows(enriched);
    onCountChange(enriched.filter((r) => r.status === "open").length);
    setLoading(false);
  }, [onCountChange]);

  useEffect(() => { void load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("app_feedback").update({ status }).eq("id", id);
    void load();
    if (detail?.id === id) setDetail((d) => d ? { ...d, status } : null);
  };

  const submitReply = async () => {
    if (!detail || !replyText.trim()) return;
    setSaving(true);
    await supabase.from("app_feedback").update({ admin_reply: replyText.trim(), status: "in_review" }).eq("id", detail.id);
    setSaving(false);
    toast.success("Reply sent");
    setReplyText("");
    void load();
    setDetail(null);
  };

  const filtered = useMemo(() => {
    let r = rows;
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    if (typeFilter !== "all") r = r.filter((x) => x.type === typeFilter);
    return r;
  }, [rows, statusFilter, typeFilter]);

  const typeIcon: Record<string, React.ElementType> = {
    bug: Bug, feature: Lightbulb, improvement: TrendingUp, other: HelpCircle,
  };
  const priorityCls: Record<string, string> = {
    critical: "bg-destructive/15 text-destructive",
    high: "bg-warning/15 text-warning",
    medium: "bg-primary/15 text-primary",
    low: "bg-muted/40 text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      <SectionHead title="App Feedback" sub="Suggestions, bugs, and feature requests from teachers." />

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Open", status: "open", cls: "bg-primary/15 text-primary" },
          { label: "In Review", status: "in_review", cls: "bg-warning/15 text-warning" },
          { label: "Resolved", status: "resolved", cls: "bg-success/15 text-success" },
        ].map(({ label, status, cls }) => {
          const cnt = rows.filter((r) => r.status === status).length;
          return (
            <button key={status} type="button" onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all ${statusFilter === status ? cls + " border-transparent" : "border-border text-muted-foreground hover:border-primary/30"}`}>
              {label} <span className="ml-1 font-bold">{cnt}</span>
            </button>
          );
        })}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="bug">Bug</SelectItem>
            <SelectItem value="feature">Feature</SelectItem>
            <SelectItem value="improvement">Improvement</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TableShell footer={`${filtered.length} of ${rows.length} submissions`}>
        <THead cols={["Teacher", "Type", "Title", "Priority", "Status", "Date", ""]} />
        <tbody className="divide-y divide-border/40">
          {loading ? <SkeletonRows cols={7} /> : filtered.length === 0 ? (
            <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">No feedback yet.</td></tr>
          ) : filtered.map((r) => {
            const TypeIcon = typeIcon[r.type] ?? HelpCircle;
            return (
              <tr key={r.id} className="hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => { setDetail(r); setReplyText(r.admin_reply ?? ""); }}>
                <td className="px-4 py-3">
                  <div className="text-xs font-medium">{r.user_name}</div>
                  <div className="text-[11px] text-muted-foreground">{r.user_email}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground capitalize">
                    <TypeIcon className="h-3.5 w-3.5" /> {r.type}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs font-medium max-w-[200px] truncate">{r.title}</td>
                <td className="px-4 py-3">
                  <Badge className={`${priorityCls[r.priority] ?? ""} border-0 text-[10px] capitalize`}>{r.priority}</Badge>
                </td>
                <td className="px-4 py-3">{statusBadge(r.status)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDateShort(r.created_at)}</td>
                <td className="px-4 py-3">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>

      {/* Detail & reply dialog */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detail && (() => { const I = typeIcon[detail.type] ?? HelpCircle; return <I className="h-4 w-4" />; })()}
              {detail?.title}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {statusBadge(detail.status)}
                <Badge className={`${priorityCls[detail.priority] ?? ""} border-0 text-[10px] capitalize`}>{detail.priority} priority</Badge>
                <span className="text-xs text-muted-foreground">from {detail.user_name} · {fmtDate(detail.created_at)}</span>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {detail.body}
              </div>
              {detail.admin_reply && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <div className="text-[10px] text-primary font-semibold uppercase tracking-wider mb-1">Admin Reply</div>
                  <p className="text-xs text-foreground whitespace-pre-wrap">{detail.admin_reply}</p>
                </div>
              )}
              <div>
                <div className="text-xs font-medium mb-1.5">Reply to teacher</div>
                <Textarea rows={3} placeholder="Type your reply…" value={replyText} onChange={(e) => setReplyText(e.target.value)} className="resize-none text-xs" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void submitReply()} disabled={saving || !replyText.trim()} className="bg-gradient-primary text-primary-foreground shadow-glow gap-1.5">
                  <Reply className="h-3.5 w-3.5" />{saving ? "Sending…" : "Send Reply"}
                </Button>
                {["open","in_review","resolved","wont_fix"].map((s) => (
                  <Button key={s} size="sm" variant="outline"
                    className={detail.status === s ? "border-primary text-primary" : ""}
                    onClick={() => void updateStatus(detail.id, s)}>
                    {s.replace("_"," ")}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PLANS
// ═══════════════════════════════════════════════════════════════
function PlansSection() {
  type PlanRow = {
    id: string; name: string; slug: string; description: string | null;
    price_monthly: number; price_yearly: number; is_active: boolean;
    stripe_price_id_monthly: string | null; stripe_price_id_yearly: string | null;
    limits: Record<string, number>; features: string[];
    subscriber_count: number;
  };
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("plans").select("*").order("sort_order");
    if (!data) { setLoading(false); return; }
    const { data: subs } = await supabase.from("user_subscriptions").select("plan_id").eq("status", "active");
    const subCnt: Record<string, number> = {};
    (subs ?? []).forEach((s) => { subCnt[s.plan_id] = (subCnt[s.plan_id] ?? 0) + 1; });
    setPlans(data.map((p) => ({
      ...p, limits: (p.limits as Record<string, number>) ?? {},
      features: (p.features as string[]) ?? [], subscriber_count: subCnt[p.id] ?? 0,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("plans").update({
      name: editing.name, description: editing.description,
      price_monthly: editing.price_monthly, price_yearly: editing.price_yearly,
      is_active: editing.is_active,
      limits: editing.limits, features: editing.features,
    }).eq("id", editing.id);
    if (error) { setSaving(false); toast.error(error.message); return; }

    // Auto-create/update Stripe prices from the entered amounts
    try {
      const { syncPlanToStripe } = await import("@/integrations/stripe/stripe.server");
      await syncPlanToStripe({
        data: {
          planId: editing.id,
          planName: editing.name,
          planSlug: editing.slug,
          priceMonthly: editing.price_monthly,
          priceYearly: editing.price_yearly,
        },
      });
      toast.success("Plan saved & Stripe prices synced");
    } catch (err) {
      toast.warning("Plan saved but Stripe sync failed — check server logs", {
        description: err instanceof Error ? err.message : String(err),
      });
    }

    setSaving(false);
    setEditing(null);
    void load();
  };

  if (loading) return <div className="space-y-3">{Array.from({length:3}).map((_,i)=><div key={i} className="h-40 rounded-2xl bg-muted/30 animate-pulse" />)}</div>;

  return (
    <div className="space-y-4">
      <SectionHead title="Plan Management" sub="Edit pricing, limits, and Stripe IDs for each subscription tier." />
      {editing ? (
        <div className="rounded-2xl border border-primary/30 bg-card/60 overflow-hidden">
          {/* Edit header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/80">
            <div className="flex items-center gap-3">
              {planBadge(editing.slug)}
              <span className="font-display font-bold text-lg">Edit Plan</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
          </div>

          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-primary" />
                <span className="text-sm font-semibold">Basic Information</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-muted-foreground mb-1 block">Monthly Price ($)</label>
                  <Input type="number" min={0} step={0.01} value={editing.price_monthly} onChange={(e) => setEditing({ ...editing, price_monthly: Number(e.target.value) })} /></div>
                <div><label className="text-xs text-muted-foreground mb-1 block">Yearly Price ($)</label>
                  <Input type="number" min={0} step={0.01} value={editing.price_yearly} onChange={(e) => setEditing({ ...editing, price_yearly: Number(e.target.value) })} /></div>
                <div className="col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Description</label>
                  <Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              </div>
            </div>

            {/* Stripe sync info */}
            <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
              <Tag className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
              <span>Stripe prices are created automatically when you save. Just enter the dollar amounts above.</span>
            </div>

            {/* Limits */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-success" />
                <span className="text-sm font-semibold">Usage Limits</span>
                <span className="text-xs text-muted-foreground ml-1">(-1 = Unlimited)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { key: "quizzes_per_day", label: "Quizzes per Day", icon: "📋" },
                  { key: "ai_calls_per_day", label: "AI Calls per Day", icon: "🤖" },
                  { key: "participants_per_session", label: "Participants per Session", icon: "👥" },
                  { key: "question_bank", label: "Question Bank Size", icon: "❓" },
                  { key: "sessions_total", label: "Total Sessions", icon: "🎯" },
                ] as { key: string; label: string; icon: string }[]).map(({ key, label, icon }) => {
                  const val = editing.limits[key] ?? -1;
                  const isUnlimited = val === -1;
                  return (
                    <div key={key} className="rounded-xl border border-border bg-muted/10 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium flex items-center gap-1.5">{icon} {label}</span>
                        <label className="flex items-center gap-1.5 cursor-pointer select-none">
                          <span className="text-[10px] text-muted-foreground">Unlimited</span>
                          <button
                            type="button"
                            onClick={() => setEditing({ ...editing, limits: { ...editing.limits, [key]: isUnlimited ? 10 : -1 } })}
                            className={`relative h-4.5 w-8 rounded-full transition-colors cursor-pointer ${isUnlimited ? "bg-primary" : "bg-muted"}`}
                          >
                            <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all ${isUnlimited ? "left-4" : "left-0.5"}`} />
                          </button>
                        </label>
                      </div>
                      {!isUnlimited && (
                        <Input
                          type="number" min={0} value={val}
                          onChange={(e) => setEditing({ ...editing, limits: { ...editing.limits, [key]: Number(e.target.value) } })}
                          className="h-8 text-sm"
                        />
                      )}
                      {isUnlimited && (
                        <div className="text-xs text-primary font-semibold px-1">∞ No limit</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Features */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-purple-400" />
                <span className="text-sm font-semibold">Features List</span>
                <span className="text-xs text-muted-foreground ml-1">shown to users on pricing page</span>
              </div>
              <div className="space-y-2">
                {editing.features.map((feat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                      <button type="button" disabled={i === 0} onClick={() => {
                        const arr = [...editing.features];
                        [arr[i-1], arr[i]] = [arr[i], arr[i-1]];
                        setEditing({ ...editing, features: arr });
                      }} className="hover:text-foreground disabled:opacity-30 cursor-pointer">▲</button>
                      <button type="button" disabled={i === editing.features.length - 1} onClick={() => {
                        const arr = [...editing.features];
                        [arr[i+1], arr[i]] = [arr[i], arr[i+1]];
                        setEditing({ ...editing, features: arr });
                      }} className="hover:text-foreground disabled:opacity-30 cursor-pointer">▼</button>
                    </div>
                    <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />
                    <Input
                      value={feat}
                      onChange={(e) => {
                        const arr = [...editing.features];
                        arr[i] = e.target.value;
                        setEditing({ ...editing, features: arr });
                      }}
                      className="h-8 text-sm flex-1"
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive/60 hover:text-destructive cursor-pointer"
                      onClick={() => setEditing({ ...editing, features: editing.features.filter((_, j) => j !== i) })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="gap-1.5 w-full mt-1 cursor-pointer"
                  onClick={() => setEditing({ ...editing, features: [...editing.features, ""] })}>
                  <Plus className="h-4 w-4" /> Add Feature
                </Button>
              </div>
            </div>
          </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 border-t border-border bg-card/90 backdrop-blur px-6 py-3 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setEditing(null)} className="cursor-pointer">Cancel</Button>
            <Button onClick={() => void save()} disabled={saving} className="bg-gradient-primary text-primary-foreground shadow-glow gap-2 cursor-pointer">
              {saving ? "Saving…" : "Save Plan"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div key={plan.id} className={`rounded-2xl border p-5 space-y-4 hover:shadow-glow hover:scale-[1.02] transition-all duration-300 ${plan.is_active ? "border-border bg-card/60" : "border-border/40 bg-card/20 opacity-60"}`}>
              <div className="flex items-start justify-between">
                <div>
                  {planBadge(plan.slug)}
                  <div className="font-display font-bold text-2xl mt-2">${plan.price_monthly}<span className="text-xs text-muted-foreground font-normal">/mo</span></div>
                  <div className="text-[11px] text-muted-foreground">${plan.price_yearly}/yr</div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(plan)}><Edit2 className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => { await supabase.from("plans").update({ is_active: !plan.is_active }).eq("id", plan.id); void load(); }}>
                    {plan.is_active ? <Ban className="h-3.5 w-3.5 text-destructive" /> : <CheckCircle className="h-3.5 w-3.5 text-success" />}
                  </Button>
                </div>
              </div>
              <div className="rounded-xl bg-muted/20 px-4 py-3 text-center border border-border">
                <div className="font-display text-3xl font-bold text-primary">{plan.subscriber_count}</div>
                <div className="text-xs text-muted-foreground">Active subscribers</div>
              </div>
              <p className="text-xs text-muted-foreground">{plan.description}</p>
              <ul className="space-y-1.5">
                {plan.features.slice(0, 5).map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle className="h-3 w-3 text-success shrink-0" />{f}
                  </li>
                ))}
                {plan.features.length > 5 && <li className="text-xs text-muted-foreground pl-4.5">+{plan.features.length - 5} more</li>}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FINANCE
// ═══════════════════════════════════════════════════════════════
function FinanceSection() {
  type PayRow = {
    id: string; user_name: string; user_email: string; plan_name: string;
    amount_cents: number; currency: string; status: string;
    description: string | null; paid_at: string;
  };
  const [payments, setPayments] = useState<PayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data } = await supabase.from("payment_history").select("*").order("paid_at", { ascending: false }).limit(200);
      if (!data?.length) { setLoading(false); return; }

      const userIds = [...new Set(data.map((p) => p.user_id))];
      const planIds = [...new Set(data.map((p) => p.plan_id).filter(Boolean))] as string[];
      const [{ data: profiles }, { data: planRows }] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email").in("id", userIds),
        supabase.from("plans").select("id,name").in("id", planIds),
      ]);
      const profMap: Record<string, { full_name: string | null; email: string | null }> = {};
      (profiles ?? []).forEach((p) => { profMap[p.id] = p; });
      const planMap: Record<string, string> = {};
      (planRows ?? []).forEach((p) => { planMap[p.id] = p.name; });

      setPayments(data.map((p) => ({
        id: p.id, user_name: profMap[p.user_id]?.full_name ?? "Unknown",
        user_email: profMap[p.user_id]?.email ?? "—",
        plan_name: p.plan_id ? (planMap[p.plan_id] ?? "—") : "—",
        amount_cents: p.amount_cents, currency: p.currency,
        status: p.status, description: p.description ?? null, paid_at: p.paid_at,
      })));
      setLoading(false);
    })();
  }, []);

  const filtered = statusFilter === "all" ? payments : payments.filter((p) => p.status === statusFilter);
  const paid = payments.filter((p) => p.status === "paid");
  const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const revenue = paid.reduce((s, p) => s + p.amount_cents, 0);
  const monthRevenue = paid.filter((p) => p.paid_at >= thisMonth).reduce((s, p) => s + p.amount_cents, 0);
  const refunds = payments.filter((p) => p.status === "refunded").reduce((s, p) => s + p.amount_cents, 0);

  const exportCSV = () => {
    const csv = ["Date,User,Email,Plan,Amount,Status",
      ...filtered.map((p) => `${fmtDate(p.paid_at)},${p.user_name},${p.user_email},${p.plan_name},${fmt$(p.amount_cents)},${p.status}`)
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `payments_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-5">
      <SectionHead title="Finance" sub="Payment history and revenue overview." />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Revenue" value={fmt$(revenue)} icon={DollarSign} color="text-success" trend={12} />
        <StatCard label="This Month" value={fmt$(monthRevenue)} icon={Calendar} color="text-primary" />
        <StatCard label="Refunds" value={fmt$(refunds)} icon={ArrowDownRight} color="text-destructive" />
      </div>
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><Filter className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all","paid","failed","refunded","pending"].map((s) => <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 ml-auto"><Download className="h-4 w-4" />Export CSV</Button>
      </div>
      <TableShell footer={`${filtered.length} transaction${filtered.length !== 1 ? "s" : ""}`}>
        <THead cols={["Date", "User", "Plan", "Amount", "Status", "Description"]} />
        <tbody className="divide-y divide-border/40">
          {loading ? <SkeletonRows cols={6} /> : filtered.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No payments found.</td></tr>
          ) : filtered.map((p) => (
            <tr key={p.id} className="hover:bg-muted/10 transition-colors">
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(p.paid_at)}</td>
              <td className="px-4 py-3"><div className="text-xs font-medium">{p.user_name}</div><div className="text-[11px] text-muted-foreground">{p.user_email}</div></td>
              <td className="px-4 py-3">{planBadge(p.plan_name.toLowerCase())}</td>
              <td className="px-4 py-3 text-right text-xs font-semibold">{fmt$(p.amount_cents)}</td>
              <td className="px-4 py-3">
                <Badge className={`text-[10px] border-0 ${p.status === "paid" ? "bg-success/15 text-success" : p.status === "refunded" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"}`}>{p.status}</Badge>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{p.description ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}

// ─── Section heading ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
// PROMO CODES
// ═══════════════════════════════════════════════════════════════

type PromoRow = {
  id: string; code: string; description: string | null;
  discount_type: "percent" | "fixed" | "free";
  discount_percent: number | null; discount_fixed_cents: number | null;
  applies_to_slugs: string[]; max_uses: number | null;
  uses_count: number; expires_at: string | null;
  is_active: boolean; created_at: string;
};

type PromoDraft = {
  code: string; description: string;
  discount_type: "percent" | "fixed" | "free";
  discount_percent: string; discount_fixed_cents: string;
  applies_to_slugs: string[];
  max_uses: string; expires_at: string; is_active: boolean;
};

function emptyPromoDraft(): PromoDraft {
  return {
    code: "", description: "", discount_type: "percent",
    discount_percent: "20", discount_fixed_cents: "500",
    applies_to_slugs: [], max_uses: "", expires_at: "", is_active: true,
  };
}

function PromoCodesSection() {
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [plans, setPlans] = useState<{ slug: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PromoRow | null>(null);
  const [draft, setDraft] = useState<PromoDraft>(emptyPromoDraft());
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [pcRes, plRes] = await Promise.all([
      supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
      supabase.from("plans").select("slug, name").eq("is_active", true).order("sort_order"),
    ]);
    setLoading(false);
    if (pcRes.data) setRows(pcRes.data as unknown as PromoRow[]);
    if (plRes.data) setPlans(plRes.data);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyPromoDraft());
    setDialogOpen(true);
  };

  const openEdit = (r: PromoRow) => {
    setEditing(r);
    setDraft({
      code: r.code,
      description: r.description ?? "",
      discount_type: r.discount_type ?? (r.discount_percent ? "percent" : r.discount_fixed_cents ? "fixed" : "free"),
      discount_percent: String(r.discount_percent ?? 20),
      discount_fixed_cents: String(r.discount_fixed_cents ?? 500),
      applies_to_slugs: r.applies_to_slugs ?? [],
      max_uses: r.max_uses != null ? String(r.max_uses) : "",
      expires_at: r.expires_at ? r.expires_at.slice(0, 16) : "",
      is_active: r.is_active,
    });
    setDialogOpen(true);
  };

  const set = <K extends keyof PromoDraft>(k: K, v: PromoDraft[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  const toggleSlug = (slug: string) =>
    set("applies_to_slugs", draft.applies_to_slugs.includes(slug)
      ? draft.applies_to_slugs.filter((s) => s !== slug)
      : [...draft.applies_to_slugs, slug]);

  const save = async () => {
    const code = draft.code.trim().toUpperCase();
    if (!code) { toast.error("Code is required"); return; }
    if (!/^[A-Z0-9_-]{2,30}$/.test(code)) {
      toast.error("Code must be 2–30 characters, letters/digits/dashes only");
      return;
    }
    setSaving(true);
    const row: Record<string, unknown> = {
      code,
      description: draft.description.trim() || null,
      discount_percent: draft.discount_type === "percent" ? Number(draft.discount_percent) : null,
      discount_fixed_cents: draft.discount_type === "fixed" ? Number(draft.discount_fixed_cents) : null,
      applies_to_slugs: draft.applies_to_slugs,
      max_uses: draft.max_uses ? Number(draft.max_uses) : null,
      expires_at: draft.expires_at ? new Date(draft.expires_at).toISOString() : null,
      is_active: draft.is_active,
    };
    if (editing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("promo_codes").update(row as any).eq("id", editing.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Promo code updated");
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("promo_codes").insert(row as any);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success(`Promo code "${code}" created`);
    }
    setSaving(false);
    setDialogOpen(false);
    void load();
  };

  const toggleActive = async (r: PromoRow) => {
    const { error } = await supabase.from("promo_codes").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, is_active: !r.is_active } : x));
    toast.success(r.is_active ? "Code deactivated" : "Code activated");
  };

  const deleteCode = async (id: string) => {
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((prev) => prev.filter((r) => r.id !== id));
    setDeleteId(null);
    toast.success("Promo code deleted");
  };

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); } catch { /* ignore */ }
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
    toast.success(`"${code}" copied`);
  };

  const discountLabel = (r: PromoRow) => {
    const dt = r.discount_type ?? (r.discount_percent ? "percent" : r.discount_fixed_cents ? "fixed" : "free");
    if (dt === "free") return "🎁 FREE";
    if (dt === "percent" && r.discount_percent) return `${r.discount_percent}% off`;
    if (dt === "fixed" && r.discount_fixed_cents) return `-$${(r.discount_fixed_cents / 100).toFixed(2)}`;
    return "—";
  };

  const isExpired = (r: PromoRow) => r.expires_at ? new Date(r.expires_at) < new Date() : false;
  const isExhausted = (r: PromoRow) => r.max_uses != null && r.uses_count >= r.max_uses;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <SectionHead
          title="Promo Codes"
          sub={`${rows.length} code${rows.length !== 1 ? "s" : ""} · ${rows.filter((r) => r.is_active && !isExpired(r) && !isExhausted(r)).length} active`}
        />
        <Button onClick={openCreate} className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4" /> New Promo Code
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total codes", value: rows.length, icon: Tag },
          { label: "Active", value: rows.filter((r) => r.is_active && !isExpired(r) && !isExhausted(r)).length, icon: CheckCircle },
          { label: "Total uses", value: rows.reduce((s, r) => s + r.uses_count, 0), icon: BarChart3 },
          { label: "Expired / exhausted", value: rows.filter((r) => isExpired(r) || isExhausted(r)).length, icon: AlertTriangle },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Icon className="h-3.5 w-3.5" /> {label}
            </div>
            <div className="font-display text-2xl font-bold">{value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonRows cols={6} />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center">
          <Tag className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="font-semibold">No promo codes yet</p>
          <p className="text-xs text-muted-foreground mt-1">Click "New Promo Code" to create your first one.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/20">
              <tr>
                {["Code", "Discount", "Plans", "Usage", "Expires", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const expired = isExpired(r);
                const exhausted = isExhausted(r);
                const bad = expired || exhausted;
                return (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <code className={`font-mono font-bold text-sm ${bad ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {r.code}
                        </code>
                        <button type="button" onClick={() => copyCode(r.code)}
                          className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors">
                          {copied === r.code ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                      {r.description && <div className="text-[11px] text-muted-foreground mt-0.5">{r.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                        r.discount_type === "free" ? "bg-success/15 text-success" :
                        r.discount_type === "percent" ? "bg-primary/15 text-primary" :
                        "bg-warning/15 text-warning"
                      }`}>
                        {discountLabel(r)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(r.applies_to_slugs ?? []).length === 0 ? (
                        <span className="text-xs text-muted-foreground">All plans</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {r.applies_to_slugs.map((s) => (
                            <span key={s} className="rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] font-bold capitalize">{s}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={exhausted ? "text-destructive font-semibold" : ""}>
                        {r.uses_count}{r.max_uses != null ? `/${r.max_uses}` : ""}
                      </span>
                      {exhausted && <div className="text-[10px] text-destructive">Limit reached</div>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {r.expires_at ? (
                        <span className={expired ? "text-destructive" : "text-muted-foreground"}>
                          {fmtDate(r.expires_at)}
                          {expired && <div className="text-[10px] text-destructive">Expired</div>}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => toggleActive(r)}
                        className={`flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 transition-colors ${
                          r.is_active && !bad
                            ? "bg-success/15 text-success hover:bg-success/25"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted/80"
                        }`}>
                        {r.is_active && !bad
                          ? <><ToggleRight className="h-3.5 w-3.5" /> Active</>
                          : <><ToggleLeft className="h-3.5 w-3.5" /> Inactive</>}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive"
                          onClick={() => setDeleteId(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) setDialogOpen(false); }}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              {editing ? "Edit Promo Code" : "New Promo Code"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-1">
            {/* Code */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Code <span className="text-destructive">*</span>
              </label>
              <Input
                value={draft.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                placeholder="SUMMER25"
                className="font-mono uppercase"
                maxLength={30}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Letters, digits, dashes. Automatically uppercased.</p>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Description</label>
              <Input value={draft.description} onChange={(e) => set("description", e.target.value)}
                placeholder="Summer 2025 promotion for teachers" />
            </div>

            {/* Discount type */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Discount type</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: "percent", icon: Percent, label: "Percentage", sub: "e.g. 20% off" },
                  { v: "fixed",   icon: DollarSign, label: "Fixed amount", sub: "e.g. $5.00 off" },
                  { v: "free",    icon: Zap, label: "Free plan", sub: "Grant free access" },
                ] as const).map(({ v, icon: Icon, label, sub }) => (
                  <button key={v} type="button" onClick={() => set("discount_type", v)}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      draft.discount_type === v
                        ? "border-primary/60 bg-primary/10"
                        : "border-border bg-card/30 hover:border-primary/30"
                    }`}>
                    <Icon className={`h-4 w-4 mb-1.5 ${draft.discount_type === v ? "text-primary" : "text-muted-foreground"}`} />
                    <div className={`text-xs font-bold ${draft.discount_type === v ? "text-primary" : ""}`}>{label}</div>
                    <div className="text-[10px] text-muted-foreground">{sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Discount value */}
            {draft.discount_type === "percent" && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Percentage off
                </label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={100} value={draft.discount_percent}
                    onChange={(e) => set("discount_percent", e.target.value)} className="w-28" />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
            )}
            {draft.discount_type === "fixed" && (
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Fixed discount (in cents)
                </label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} value={draft.discount_fixed_cents}
                    onChange={(e) => set("discount_fixed_cents", e.target.value)} className="w-28" />
                  <span className="text-muted-foreground text-sm">
                    = ${(Number(draft.discount_fixed_cents || 0) / 100).toFixed(2)} off
                  </span>
                </div>
              </div>
            )}
            {draft.discount_type === "free" && (
              <div className="rounded-xl border border-success/30 bg-success/5 p-3 text-xs text-success">
                🎁 This code will grant the selected plan for free (100% off). Choose which plan(s) below.
              </div>
            )}

            {/* Applies to plans */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Applies to plans
                <span className="ml-1.5 font-normal normal-case text-muted-foreground/70">(leave empty = all plans)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {plans.filter((p) => p.slug !== "free").map((p) => (
                  <button key={p.slug} type="button" onClick={() => toggleSlug(p.slug)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                      draft.applies_to_slugs.includes(p.slug)
                        ? "border-primary/60 bg-primary/15 text-primary"
                        : "border-border bg-card/30 text-muted-foreground hover:border-primary/30"
                    }`}>
                    {draft.applies_to_slugs.includes(p.slug) && <Check className="inline h-3 w-3 mr-1" />}
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Max uses + expiry */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Max uses
                  <span className="ml-1 font-normal normal-case text-muted-foreground/70">(blank = unlimited)</span>
                </label>
                <Input type="number" min={1} value={draft.max_uses}
                  onChange={(e) => set("max_uses", e.target.value)} placeholder="∞" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Expires at
                  <span className="ml-1 font-normal normal-case text-muted-foreground/70">(blank = never)</span>
                </label>
                <Input type="datetime-local" value={draft.expires_at}
                  onChange={(e) => set("expires_at", e.target.value)}
                  min={new Date().toISOString().slice(0, 16)} />
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-card/40 px-4 py-3">
              <div>
                <div className="text-sm font-semibold">Active</div>
                <div className="text-xs text-muted-foreground mt-0.5">Inactive codes cannot be redeemed</div>
              </div>
              <button type="button" onClick={() => set("is_active", !draft.is_active)}
                className={`relative h-6 w-11 rounded-full transition-colors ${draft.is_active ? "bg-primary" : "bg-muted"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${draft.is_active ? "left-5" : "left-0.5"}`} />
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-gradient-primary text-primary-foreground shadow-glow gap-2">
              <Tag className="h-4 w-4" />
              {saving ? "Saving…" : editing ? "Save changes" : "Create code"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div className="relative z-10 rounded-2xl border border-border bg-card p-6 max-w-sm w-full space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Delete promo code?</p>
                <p className="text-sm text-muted-foreground mt-1">This cannot be undone. Hosts who already redeemed it won't be affected.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void deleteCode(deleteId)}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-2">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <p className="text-sm text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}
