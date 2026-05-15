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
  Coins, Wallet, TrendingDown, MinusCircle, PlusCircle,
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
  const isEnterprise = slug.startsWith("enterprise");
  const isFree = slug.endsWith("starter");
  const cls = isEnterprise ? "bg-warning/15 text-warning" : isFree ? "bg-muted/40 text-muted-foreground" : "bg-primary/15 text-primary";
  const label = slug.replace("individual_", "").replace("enterprise_", "Org ").replace("_", " ");
  return (
    <Badge className={`${cls} border-0 text-[10px] capitalize`}>
      {isEnterprise ? <Building2 className="h-3 w-3 mr-0.5 inline" /> :
       isFree ? <Zap className="h-3 w-3 mr-0.5 inline" /> :
       <Star className="h-3 w-3 mr-0.5 inline" />}
      {label}
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
    <div className="min-h-[112px] rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-5 hover:shadow-glow hover:border-primary/40 md:hover:scale-[1.02] transition-all duration-300 cursor-default">
      <div className="flex items-start justify-between">
        <div className="rounded-lg md:rounded-xl p-2 bg-primary/10">
          <Icon className={`h-4 w-4 md:h-5 md:w-5 ${color}`} />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? "text-success" : "text-destructive"}`}>
            {trend >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <div className="font-display text-xl md:text-2xl font-bold leading-tight break-words">{value}</div>
        <div className="text-[11px] md:text-xs text-muted-foreground mt-1 leading-snug">{label}</div>
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
    <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 overflow-hidden">
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[720px] text-sm">{children}</table>
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
  { key: "credits",      label: "Credits",         icon: Coins },
  { key: "promocodes",   label: "Promo Codes",     icon: Tag },
  { key: "finance",      label: "Finance",         icon: DollarSign },
];

const NAV_GROUPS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, sections: ["overview"] },
  { key: "people", label: "People", icon: Users, sections: ["users", "participants"] },
  { key: "content", label: "Content", icon: PlayCircle, sections: ["quizzes", "categories"] },
  { key: "feedback", label: "Feedback", icon: MessageSquare, sections: ["reviews", "appfeedback"] },
  { key: "money", label: "Money", icon: Wallet, sections: ["plans", "credits", "promocodes", "finance"] },
] as const;

function getNavGroup(section: string) {
  return NAV_GROUPS.find((group) => (group.sections as readonly string[]).includes(section)) ?? NAV_GROUPS[0];
}

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
        if (!data) { toast.error("Access denied - admins only"); void navigate({ to: "/dashboard" }); return; }
        setIsAdmin(true);
        // Only fetch after admin role is confirmed
        supabase.from("app_feedback").select("id", { count: "exact", head: true }).eq("status", "open")
          .then(({ count }) => setFeedbackBadge(count ?? 0));
      });
  }, [user, navigate]);

  if (isAdmin === null) return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm animate-pulse">
      Verifying admin access…
    </div>
  );

  const navItems: NavItem[] = NAV.map((n) =>
    n.key === "appfeedback" && feedbackBadge > 0 ? { ...n, badge: feedbackBadge } : n
  );
  const activeItem = navItems.find((item) => item.key === section) ?? navItems[0];
  const activeGroup = getNavGroup(section);
  const mobileSubNav = activeGroup.sections
    .map((key) => navItems.find((item) => item.key === key))
    .filter(Boolean) as NavItem[];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card/90 backdrop-blur sticky top-0 z-50 px-3 sm:px-4 py-3 flex items-center gap-3 shrink-0">
        <button type="button" onClick={() => setSidebarOpen((v) => !v)}
          title={sidebarOpen ? "Collapse navigation" : "Expand navigation"}
          className="hidden md:inline-flex rounded-xl p-1.5 hover:bg-muted/40 transition-colors text-muted-foreground">
          <Layers className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="rounded-xl bg-gradient-primary p-1.5 shadow-glow">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <span className="block font-display font-bold leading-tight truncate">Admin Dashboard</span>
            <span className="block md:hidden text-[11px] text-muted-foreground truncate">{activeItem.label}</span>
          </div>
          <Badge className="hidden sm:inline-flex bg-destructive/15 text-destructive border-0 text-[10px]">ADMIN</Badge>
        </div>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/dashboard" })} className="h-9 px-2 sm:px-3">
            ← Back to App
          </Button>
        </div>
      </header>

      <div className="md:hidden sticky top-[57px] z-40 border-b border-border bg-background/95 backdrop-blur px-3 py-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {mobileSubNav.map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`min-h-11 shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors inline-flex items-center gap-2 ${
                section === key
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border bg-card/50 text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              {badge ? (
                <span className="rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5">
                  {badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? "w-52" : "w-14"} hidden md:flex shrink-0 border-r border-border bg-card/60 transition-all duration-300 flex-col`}>
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
        <main className="flex-1 overflow-y-auto px-3 py-4 pb-28 sm:p-5 md:pb-5">
          {section === "overview"     && <OverviewSection onNavigate={setSection} />}
          {section === "users"        && <UsersSection />}
          {section === "participants" && <ParticipantsSection />}
          {section === "quizzes"      && <QuizzesSection />}
          {section === "categories"   && <CategoriesSection />}
          {section === "reviews"      && <ReviewsSection />}
          {section === "appfeedback"  && <AppFeedbackSection onCountChange={setFeedbackBadge} />}
          {section === "plans"        && <PlansSection />}
          {section === "credits"      && <CreditsSection />}
          {section === "promocodes"   && <PromoCodesSection />}
          {section === "finance"      && <FinanceSection />}
        </main>
      </div>

      <nav className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <div className="grid grid-cols-5 gap-1">
          {NAV_GROUPS.map(({ key, label, icon: Icon, sections }) => {
            const selected = (sections as readonly string[]).includes(section);
            const target = sections[0];
            const groupBadge = (sections as readonly string[]).includes("appfeedback") ? feedbackBadge : 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSection(target)}
                className={`relative min-h-14 rounded-xl px-1.5 py-1.5 text-[10px] font-semibold transition-colors flex flex-col items-center justify-center gap-1 ${
                  selected
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="leading-none">{label}</span>
                {groupBadge > 0 && (
                  <span className="absolute right-2 top-1.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-1.5 py-0.5">
                    {groupBadge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
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
        supabase.from("manual_payments").select("amount_pkr").eq("status", "approved"),
        supabase.from("profiles").select("id, full_name, email, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("quiz_sessions").select("id, title, owner_id, status, created_at").order("created_at", { ascending: false }).limit(5),
      ]);

      const revenue = (payments ?? []).reduce((s, p) => s + (p.amount_pkr ?? 0), 0);
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
        name: p.full_name ?? "-", email: p.email ?? "-",
        plan: planMap[p.id] ?? "free", joined: p.created_at,
      })));

      // enrich quizzes with owner name
      const ownerIds = [...new Set((sessions ?? []).map((s) => s.owner_id))];
      const { data: owners } = await supabase.from("profiles").select("id, full_name").in("id", ownerIds);
      const ownerMap: Record<string, string> = {};
      (owners ?? []).forEach((o) => { ownerMap[o.id] = o.full_name ?? "-"; });
      setRecentQuizzes((sessions ?? []).map((s) => ({
        title: s.title, owner: ownerMap[s.owner_id] ?? "-",
        status: s.status, created: s.created_at,
      })));

      setLoading(false);
    })();
  }, [dateFilter]);

  // filter recentUsers by plan
  const filteredRecentUsers = planFilter === "all" ? recentUsers : recentUsers.filter((u) => u.plan === planFilter);

  if (loading) return <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">{Array.from({length:6}).map((_,i)=><div key={i} className="h-28 rounded-xl md:rounded-2xl bg-muted/30 animate-pulse" />)}</div>;

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col md:flex-row md:flex-wrap md:items-center md:justify-between gap-3">
        <SectionHead title="Platform Overview" sub="Real-time snapshot of the entire platform." />
        <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:flex-wrap">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full md:w-36 h-10 md:h-8 text-xs"><Calendar className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">This month</SelectItem>
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-full md:w-40 h-10 md:h-8 text-xs"><Filter className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              <SelectItem value="individual_starter">Individual Free</SelectItem>
              <SelectItem value="individual_pro">Individual Pro</SelectItem>
              <SelectItem value="individual_pro_plus">Individual Pro+</SelectItem>
              <SelectItem value="enterprise_starter">Org Free</SelectItem>
              <SelectItem value="enterprise_pro">Org Pro</SelectItem>
              <SelectItem value="enterprise_elite">Org Elite</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        <button type="button" onClick={() => onNavigate("users")} className="text-left min-w-0">
          <StatCard label="Total Hosts" value={stats.users} icon={Users} trend={12} />
        </button>
        <button type="button" onClick={() => onNavigate("participants")} className="text-left min-w-0">
          <StatCard label="Total Participants" value={stats.participants} icon={UsersRound} color="text-success" />
        </button>
        <button type="button" onClick={() => onNavigate("quizzes")} className="text-left min-w-0">
          <StatCard label="Quiz Sessions" value={stats.sessions} icon={PlayCircle} />
        </button>
        <button type="button" onClick={() => onNavigate("categories")} className="text-left min-w-0">
          <StatCard label="Questions" value={stats.questions} icon={BookOpen} />
        </button>
        <button type="button" onClick={() => onNavigate("categories")} className="text-left min-w-0">
          <StatCard label="Categories" value={stats.categories} icon={FolderTree} />
        </button>
        <button type="button" onClick={() => onNavigate("reviews")} className="text-left min-w-0">
          <StatCard label="Student Reviews" value={stats.feedback} icon={Star} color="text-warning" />
        </button>
        <button type="button" onClick={() => onNavigate("plans")} className="text-left min-w-0">
          <StatCard label="Active Subscriptions" value={stats.active_subs} icon={CreditCard} color="text-primary" trend={8} />
        </button>
        <button type="button" onClick={() => onNavigate("finance")} className="text-left min-w-0">
          <StatCard label="Revenue (PKR)" value={`PKR ${stats.revenue.toLocaleString()}`} icon={DollarSign} color="text-warning" />
        </button>
        <button type="button" onClick={() => onNavigate("users")} className="text-left min-w-0">
          <StatCard label="New Hosts (Month)" value={stats.new_users} icon={TrendingUp} color="text-success" trend={stats.new_users > 0 ? 15 : 0} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent signups */}
        <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
          <div className="px-4 md:px-5 py-3 border-b border-border/60 bg-muted/20 flex items-center justify-between">
            <span className="font-semibold text-sm">Recent Host Signups</span>
            <button type="button" onClick={() => onNavigate("users")} className="text-[11px] text-primary hover:underline">View all</button>
          </div>
          <div className="divide-y divide-border/40">
            {filteredRecentUsers.map((u, i) => (
              <div key={i} className="px-4 py-3 flex items-start sm:items-center gap-3 hover:bg-muted/10">
                <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{u.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{u.email}</div>
                </div>
                <div className="shrink-0">{planBadge(u.plan)}</div>
                <span className="hidden sm:inline text-[11px] text-muted-foreground shrink-0">{ago(u.joined)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent quizzes */}
        <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
          <div className="px-4 md:px-5 py-3 border-b border-border/60 bg-muted/20 flex items-center justify-between">
            <span className="font-semibold text-sm">Recent Quiz Sessions</span>
            <button type="button" onClick={() => onNavigate("quizzes")} className="text-[11px] text-primary hover:underline">View all</button>
          </div>
          <div className="divide-y divide-border/40">
            {recentQuizzes.map((q, i) => (
              <div key={i} className="px-4 py-3 flex items-start sm:items-center gap-3 hover:bg-muted/10">
                <div className="h-8 w-8 rounded-xl bg-muted/40 flex items-center justify-center shrink-0">
                  <PlayCircle className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{q.title}</div>
                  <div className="text-[11px] text-muted-foreground">by {q.owner}</div>
                </div>
                <div className="shrink-0">{statusBadge(q.status)}</div>
                <span className="hidden sm:inline text-[11px] text-muted-foreground shrink-0">{ago(q.created)}</span>
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
    expires_at: string | null;
    plan_limits: Record<string, number>;
    plan_features: string[];
  } | null>(null);
  const [payments, setPayments] = useState<{ amount_pkr: number; status: string; created_at: string; payment_method: string }[]>([]);
  const [recentSessions, setRecentSessions] = useState<{ id: string; title: string; status: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [subRes, payRes, sessRes] = await Promise.all([
        supabase.from("user_subscriptions").select("*, plans(name, credits_per_month, quizzes_per_day, participants_per_session, sessions_total, features_list)").eq("user_id", user.id).maybeSingle(),
        supabase.from("manual_payments").select("amount_pkr, status, created_at, payment_method").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("quiz_sessions").select("id, title, status, created_at").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(5),
      ]);
      if (subRes.data) {
        const raw = subRes.data as unknown as Record<string, unknown>;
        const plan = (raw.plans ?? null) as Record<string, unknown> | null;
        setSubDetails({
          plan_name: (plan?.name as string) ?? user.plan_slug,
          status: (raw.status as string) ?? "-",
          started_at: (raw.started_at as string | null) ?? null,
          expires_at: (raw.expires_at as string | null) ?? null,
          plan_limits: {
            quizzes_per_day: (plan?.quizzes_per_day as number) ?? 0,
            participants_per_session: (plan?.participants_per_session as number) ?? 0,
            sessions_total: (plan?.sessions_total as number) ?? 0,
            credits_per_month: (plan?.credits_per_month as number) ?? 0,
          },
          plan_features: (plan?.features_list as string[]) ?? [],
        });
      }
      const pays = (payRes.data ?? []) as unknown as { amount_pkr: number; status: string; created_at: string; payment_method: string }[];
      setPayments(pays);
      setRecentSessions(sessRes.data ?? []);
      setLoading(false);
    })();
  }, [user.id]);

  const limitLabels: Record<string, string> = {
    quizzes_per_day: "Quizzes / day",
    participants_per_session: "Participants / session",
    sessions_total: "Total sessions",
    credits_per_month: "Credits / month",
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-primary/15 flex items-center justify-center text-primary font-bold text-2xl shrink-0">
          {(user.full_name ?? user.email ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-lg">{user.full_name ?? "-"}</div>
          <div className="text-sm text-muted-foreground">{user.email ?? "-"}</div>
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
              <div className="text-xs font-medium">{v ?? "-"}</div>
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
                  ["Started", subDetails.started_at ? fmtDate(subDetails.started_at) : "-"],
                  ["Expires", subDetails.expires_at ? fmtDate(subDetails.expires_at) : "-"],
                ].map(([l, v]) => (
                  <div key={l} className="space-y-0.5">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{l}</div>
                    <div className="text-xs font-medium capitalize">{v ?? "-"}</div>
                  </div>
                ))}
              </div>
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
                      <div className="font-medium capitalize">{p.payment_method.replace("_", " ")}</div>
                      <div className="text-muted-foreground">{fmtDate(p.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">PKR {p.amount_pkr.toLocaleString()}</span>
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
        <div className="flex flex-wrap gap-2">
          {[
            { s: "individual_starter", label: "Ind. Free" },
            { s: "individual_pro", label: "Ind. Pro" },
            { s: "individual_pro_plus", label: "Ind. Pro+" },
            { s: "enterprise_starter", label: "Org Free" },
            { s: "enterprise_pro", label: "Org Pro" },
            { s: "enterprise_elite", label: "Org Elite" },
          ].map(({ s, label }) => (
            <button key={s} type="button"
              onClick={() => onChangePlan(user.id, s)}
              className={`flex-1 text-xs py-2 rounded-xl border font-medium transition-colors ${user.plan_slug === s ? "bg-primary/20 border-primary/40 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"}`}>
              {label}
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
type CompanyGroup = {
  company_id: string;
  company_name: string;
  admin_user_id: string;
  member_user_ids: string[];
};

function UsersSection() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [companies, setCompanies] = useState<CompanyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [detail, setDetail] = useState<UserRow | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles")
      .select("id,full_name,email,organization,country,mobile,created_at")
      .order("created_at", { ascending: false });
    if (!profiles?.length) { setLoading(false); return; }
    const ids = profiles.map((p) => p.id);

    const [{ data: subs }, { data: sess }, { data: qs }, { data: parts }, { data: cps }, { data: cms }] = await Promise.all([
      supabase.from("user_subscriptions").select("user_id,status,plans(slug)").in("user_id", ids),
      supabase.from("quiz_sessions").select("owner_id").in("owner_id", ids),
      supabase.from("questions").select("owner_id").in("owner_id", ids),
      supabase.from("participants").select("owner_id").in("owner_id", ids),
      supabase.from("company_profiles").select("id, admin_user_id, company_name"),
      (supabase.from("company_members") as any).select("user_id, company_id, status").eq("status", "active"),
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

    // Build company groups: admin + members
    const memberByCompany: Record<string, string[]> = {};
    ((cms ?? []) as { user_id: string | null; company_id: string }[]).forEach((m) => {
      if (m.user_id && m.company_id) (memberByCompany[m.company_id] ||= []).push(m.user_id);
    });
    setCompanies(
      ((cps ?? []) as { id: string; admin_user_id: string; company_name: string }[]).map((c) => ({
        company_id: c.id,
        company_name: c.company_name,
        admin_user_id: c.admin_user_id,
        member_user_ids: memberByCompany[c.id] ?? [],
      })),
    );

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

  // Group filtered rows: company admin first, then their hosts. Independent users last.
  const grouped = useMemo(() => {
    const byId = new Map(filtered.map((r) => [r.id, r] as const));
    const used = new Set<string>();
    const groups: Array<{ company_id: string; company_name: string; admin: UserRow | null; members: UserRow[] }> = [];

    // Stable order: sort companies by name so admins appear consistently
    const sortedCompanies = [...companies].sort((a, b) => a.company_name.localeCompare(b.company_name));
    for (const c of sortedCompanies) {
      const admin = byId.get(c.admin_user_id) ?? null;
      if (admin) used.add(admin.id);
      const members = c.member_user_ids
        .map((id) => byId.get(id))
        .filter((m): m is UserRow => !!m);
      members.forEach((m) => used.add(m.id));
      if (admin || members.length > 0) {
        groups.push({ company_id: c.company_id, company_name: c.company_name, admin, members });
      }
    }
    const independent = filtered.filter((u) => !used.has(u.id));
    return { groups, independent };
  }, [filtered, companies]);

  const toggleGroup = (companyId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) next.delete(companyId); else next.add(companyId);
      return next;
    });
  };

  const renderUserRow = (u: UserRow, indent: "none" | "host" = "none") => (
    <tr key={u.id} className="hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => setDetail(u)}>
      <td className="px-4 py-3">
        <div className={`flex items-center gap-2.5 ${indent === "host" ? "pl-8" : ""}`}>
          <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold shrink-0">
            {(u.full_name ?? u.email ?? "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-xs font-medium flex items-center gap-1.5">
              {u.full_name ?? "-"}
              {indent === "host" && <Badge className="bg-blue-500/10 text-blue-600 border-0 text-[9px] px-1.5 py-0">Host</Badge>}
            </div>
            <div className="text-[11px] text-muted-foreground">{u.email ?? "-"}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{[u.organization, u.country].filter(Boolean).join(" · ") || "-"}</td>
      <td className="px-4 py-3">
        {indent === "host"
          ? <span className="text-[10px] text-muted-foreground italic">via org</span>
          : planBadge(u.plan_slug)}
      </td>
      <td className="px-4 py-3 text-xs font-medium text-center">{u.session_count}</td>
      <td className="px-4 py-3 text-xs font-medium text-center">{u.question_count}</td>
      <td className="px-4 py-3 text-xs font-medium text-center">{u.participant_count}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(u.created_at)}</td>
      <td className="px-4 py-3">
        {indent === "host"
          ? <span className="text-[10px] text-muted-foreground italic">managed by org</span>
          : (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              {[
                { s: "individual_starter", label: "Free" },
                { s: "individual_pro", label: "Pro" },
                { s: "enterprise_pro", label: "Org" },
              ].map(({ s, label }) => (
                <button key={s} type="button" title={`Set ${s}`}
                  onClick={() => void changePlan(u.id, s)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${u.plan_slug === s ? "bg-primary/20 border-primary/30 text-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
      </td>
    </tr>
  );

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
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-3">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search name, email, org…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-full sm:w-44 h-11 sm:h-9"><Filter className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            <SelectItem value="individual_starter">Individual Free</SelectItem>
            <SelectItem value="individual_pro">Individual Pro</SelectItem>
            <SelectItem value="individual_pro_plus">Individual Pro+</SelectItem>
            <SelectItem value="enterprise_starter">Org Free</SelectItem>
            <SelectItem value="enterprise_pro">Org Pro</SelectItem>
            <SelectItem value="enterprise_elite">Org Elite</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => void load()} className="h-11 sm:h-8 gap-1.5"><RefreshCw className="h-4 w-4" />Refresh</Button>
      </div>

      <TableShell footer={`${filtered.length} of ${rows.length} users · ${grouped.groups.length} companies`}>
        <THead cols={["User", "Org / Country", "Plan", "Sessions", "Questions", "Participants", "Joined", ""]} />
        <tbody className="divide-y divide-border/40">
          {loading ? <SkeletonRows cols={8} /> : filtered.length === 0 ? (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No users found.</td></tr>
          ) : (
            <>
              {grouped.groups.map((g) => {
                const isCollapsed = collapsed.has(g.company_id);
                return (
                  <React.Fragment key={`co-${g.company_id}`}>
                    {/* Company group header */}
                    <tr className="bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer" onClick={() => toggleGroup(g.company_id)}>
                      <td colSpan={8} className="px-4 py-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          <Building2 className="h-3.5 w-3.5" />
                          <span>{g.company_name}</span>
                          <span className="text-muted-foreground font-normal">·</span>
                          <span className="text-muted-foreground font-normal">{g.members.length} host{g.members.length === 1 ? "" : "s"}</span>
                        </div>
                      </td>
                    </tr>
                    {!isCollapsed && g.admin && renderUserRow(g.admin, "none")}
                    {!isCollapsed && g.members.map((m) => renderUserRow(m, "host"))}
                  </React.Fragment>
                );
              })}
              {grouped.independent.length > 0 && (
                <>
                  <tr className="bg-muted/30">
                    <td colSpan={8} className="px-4 py-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>Individual Users</span>
                        <span className="font-normal">·</span>
                        <span className="font-normal">{grouped.independent.length}</span>
                      </div>
                    </td>
                  </tr>
                  {grouped.independent.map((u) => renderUserRow(u, "none"))}
                </>
              )}
            </>
          )}
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
    (owners ?? []).forEach((o) => { ownerMap[o.id] = o.full_name ?? "-"; });
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
      owner_name: ownerMap[p.owner_id] ?? "-",
      subtype: p.subtype_id ? (subMap[p.subtype_id] ?? "-") : "-",
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
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, mobile…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 sm:h-9"
          />
        </div>
        <Select value={sort} onValueChange={(value) => setSort(value as "created_at" | "name")}>
          <SelectTrigger className="w-full sm:w-40 h-11 sm:h-9">
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
                <div className="text-[11px] text-muted-foreground">{r.email ?? r.mobile ?? "-"}</div>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{r.owner_name}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{r.subtype}</td>
              <td className="px-4 py-3 text-xs font-medium text-center">{r.attempt_count}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Progress value={r.avg_score} className="h-1.5 w-16" />
                  <span className={`text-xs font-semibold ${r.avg_score >= 70 ? "text-success" : r.avg_score >= 40 ? "text-warning" : "text-destructive"}`}>
                    {r.attempt_count > 0 ? `${r.avg_score}%` : "-"}
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
      (owners ?? []).forEach((o) => { ownerMap[o.id] = { name: o.full_name ?? "-", email: o.email ?? "-" }; });

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
        owner_name: ownerMap[s.owner_id]?.name ?? "-", owner_email: ownerMap[s.owner_id]?.email ?? "-",
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
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search title, host, type…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36 h-11 sm:h-9"><SelectValue /></SelectTrigger>
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
              <td className="px-4 py-3 text-xs text-muted-foreground">{r.topic ?? "-"}</td>
              <td className="px-4 py-3">{statusBadge(r.status)}</td>
              <td className="px-4 py-3 text-xs font-medium text-center">{r.q_count}</td>
              <td className="px-4 py-3 text-xs font-medium text-center">{r.attempt_count}</td>
              <td className="px-4 py-3">
                {r.attempt_count > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <Progress value={r.avg_score} className="h-1.5 w-12" />
                    <span className={`text-xs font-semibold ${r.avg_score >= 70 ? "text-success" : r.avg_score >= 40 ? "text-warning" : "text-destructive"}`}>{r.avg_score}%</span>
                  </div>
                ) : <span className="text-xs text-muted-foreground">-</span>}
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
      (owners ?? []).forEach((o) => { ownerMap[o.id] = o.full_name ?? "-"; });
      const subCnt: Record<string, number> = {};
      (subs ?? []).forEach((s) => { subCnt[s.category_id] = (subCnt[s.category_id] ?? 0) + 1; });
      const qCnt: Record<string, number> = {};
      (qs ?? []).forEach((q) => { if (q.category_id) qCnt[q.category_id] = (qCnt[q.category_id] ?? 0) + 1; });

      setRows(cats.map((c) => ({
        id: c.id, name: c.name, subject: c.subject, icon: c.icon,
        owner_name: ownerMap[c.owner_id] ?? "-",
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
      <div className="relative max-w-sm sm:max-w-md">
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
              <td className="px-4 py-3 text-xs text-muted-foreground">{r.subject ?? "-"}</td>
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
      (owners ?? []).forEach((o) => { ownerMap[o.id] = { name: o.full_name ?? "-", email: o.email ?? "-" }; });

      setRows(feedback.map((f) => {
        const sess = sessMap[f.session_id];
        const owner = sess ? (ownerMap[sess.owner_id] ?? { name: "-", email: "-" }) : { name: "-", email: "-" };
        return {
          id: f.id, session_title: sess?.title ?? "-",
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

  const avg = rows.length ? (rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(1) : "-";
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

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div className="relative min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search quiz, host, participant…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-full sm:w-32 h-11 sm:h-9"><SelectValue /></SelectTrigger>
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
                <div className="text-[11px] text-muted-foreground">{r.participant_email ?? "-"}</div>
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
    (profiles ?? []).forEach((p) => { profMap[p.id] = { name: p.full_name ?? "-", email: p.email ?? "-" }; });

    const enriched = data.map((d) => ({
      id: d.id, user_name: profMap[d.user_id]?.name ?? "-", user_email: profMap[d.user_id]?.email ?? "-",
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
              className={`min-h-10 rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all ${statusFilter === status ? cls + " border-transparent" : "border-border text-muted-foreground hover:border-primary/30"}`}>
              {label} <span className="ml-1 font-bold">{cnt}</span>
            </button>
          );
        })}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 h-10 sm:h-8"><SelectValue /></SelectTrigger>
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
    id: string; name: string; slug: string; tier: string; description: string | null;
    price_pkr: number; credits_per_month: number; is_active: boolean;
    quizzes_per_day: number; participants_per_session: number;
    participants_total: number; question_bank: number; sessions_total: number;
    max_hosts: number; ai_enabled: boolean; custom_branding: boolean; white_label: boolean;
    credit_cost_ai_10q: number; credit_cost_ai_scan: number;
    credit_cost_extra_quiz: number; credit_cost_extra_participants: number;
    credit_cost_session_launch: number; credit_cost_export: number;
    features_list: string[];
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
    (subs ?? []).forEach((s: { plan_id: string }) => { subCnt[s.plan_id] = (subCnt[s.plan_id] ?? 0) + 1; });
    setPlans(data.map((p) => ({
      ...p,
      features_list: (p.features_list as string[]) ?? [],
      subscriber_count: subCnt[p.id] ?? 0,
      credit_cost_session_launch: (p.credit_cost_session_launch as number) ?? 0,
      credit_cost_export: (p.credit_cost_export as number) ?? 0,
    })) as PlanRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("plans").update({
      name: editing.name, description: editing.description,
      price_pkr: editing.price_pkr, credits_per_month: editing.credits_per_month,
      is_active: editing.is_active, quizzes_per_day: editing.quizzes_per_day,
      participants_per_session: editing.participants_per_session,
      participants_total: editing.participants_total, question_bank: editing.question_bank,
      sessions_total: editing.sessions_total, max_hosts: editing.max_hosts,
      ai_enabled: editing.ai_enabled, custom_branding: editing.custom_branding,
      white_label: editing.white_label,
      credit_cost_ai_10q: editing.credit_cost_ai_10q,
      credit_cost_ai_scan: editing.credit_cost_ai_scan,
      credit_cost_extra_quiz: editing.credit_cost_extra_quiz,
      credit_cost_extra_participants: editing.credit_cost_extra_participants,
      credit_cost_session_launch: editing.credit_cost_session_launch,
      credit_cost_export: editing.credit_cost_export,
      features_list: editing.features_list,
    }).eq("id", editing.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Plan saved");
    setEditing(null);
    void load();
  };

  if (loading) return <div className="space-y-3">{Array.from({length:3}).map((_,i)=><div key={i} className="h-40 rounded-2xl bg-muted/30 animate-pulse" />)}</div>;

  const numField = (label: string, val: number, key: keyof PlanRow) => (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label} (-1=∞)</label>
      <Input type="number" min={-1} value={val}
        onChange={(e) => editing && setEditing({ ...editing, [key]: Number(e.target.value) })} />
    </div>
  );

  return (
    <div className="space-y-4">
      <SectionHead title="Plan Management" sub="Edit pricing, credits, limits, and features for each plan." />
      {editing ? (
        <div className="rounded-2xl border border-primary/30 bg-card/60 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/80">
            <div className="flex items-center gap-3">
              {planBadge(editing.slug)}
              <span className="font-display font-bold text-lg">Edit: {editing.name}</span>
              <Badge className="bg-muted text-muted-foreground border-0 text-[10px] capitalize">{editing.tier}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
          </div>

          <div className="p-6 space-y-6">
            {/* Pricing */}
            <div>
              <div className="flex items-center gap-2 mb-3"><div className="h-6 w-1 rounded-full bg-primary" /><span className="text-sm font-semibold">Pricing & Credits</span></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div><label className="text-xs text-muted-foreground mb-1 block">Price (PKR/month)</label>
                  <Input type="number" min={0} value={editing.price_pkr} onChange={(e) => setEditing({ ...editing, price_pkr: Number(e.target.value) })} /></div>
                <div><label className="text-xs text-muted-foreground mb-1 block">Credits/month</label>
                  <Input type="number" min={0} value={editing.credits_per_month} onChange={(e) => setEditing({ ...editing, credits_per_month: Number(e.target.value) })} /></div>
                <div className="sm:col-span-3"><label className="text-xs text-muted-foreground mb-1 block">Description</label>
                  <Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              </div>
            </div>

            {/* Limits */}
            <div>
              <div className="flex items-center gap-2 mb-3"><div className="h-6 w-1 rounded-full bg-success" /><span className="text-sm font-semibold">Usage Limits</span></div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {numField("Quizzes/day", editing.quizzes_per_day, "quizzes_per_day")}
                {numField("Participants/session", editing.participants_per_session, "participants_per_session")}
                {numField("Total participants", editing.participants_total, "participants_total")}
                {numField("Question bank", editing.question_bank, "question_bank")}
                {numField("Max hosts (enterprise)", editing.max_hosts, "max_hosts")}
                {numField("AI calls/day", editing.ai_enabled ? -1 : 0, "max_hosts")}
              </div>
            </div>

            {/* Credit costs */}
            <div>
              <div className="flex items-center gap-2 mb-3"><div className="h-6 w-1 rounded-full bg-warning" /><span className="text-sm font-semibold">Credit Costs per Action</span></div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {numField("AI: Generate 10 Qs", editing.credit_cost_ai_10q, "credit_cost_ai_10q")}
                {numField("AI: OCR Image Scan", editing.credit_cost_ai_scan, "credit_cost_ai_scan")}
                {numField("Launch Session", editing.credit_cost_session_launch, "credit_cost_session_launch")}
                {numField("Export PDF/Excel", editing.credit_cost_export, "credit_cost_export")}
                {numField("Extra Quiz Slot", editing.credit_cost_extra_quiz, "credit_cost_extra_quiz")}
                {numField("Extra 10 Participants", editing.credit_cost_extra_participants, "credit_cost_extra_participants")}
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">Set 0 to make an action free. AI costs scale per-question (e.g. 10 credits per 10q = 1 credit/question). Session launch and export default to 0.</p>
            </div>

            {/* Feature flags */}
            <div>
              <div className="flex items-center gap-2 mb-3"><div className="h-6 w-1 rounded-full bg-purple-400" /><span className="text-sm font-semibold">Feature Flags</span></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                  { key: "ai_enabled", label: "AI Enabled" },
                  { key: "custom_branding", label: "Custom Branding" },
                  { key: "white_label", label: "White Label" },
                ] as { key: keyof PlanRow; label: string }[]).map(({ key, label }) => (
                  <label key={String(key)} className="flex items-center gap-3 rounded-xl border border-border bg-muted/10 p-3 cursor-pointer">
                    <input type="checkbox" checked={editing[key] as boolean}
                      onChange={(e) => setEditing({ ...editing, [key]: e.target.checked })}
                      className="h-4 w-4 accent-primary" />
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Features list */}
            <div>
              <div className="flex items-center gap-2 mb-3"><div className="h-6 w-1 rounded-full bg-blue-400" /><span className="text-sm font-semibold">Features List</span><span className="text-xs text-muted-foreground ml-1">shown on pricing page</span></div>
              <div className="space-y-2">
                {editing.features_list.map((feat, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />
                    <Input value={feat} onChange={(e) => { const arr=[...editing.features_list]; arr[i]=e.target.value; setEditing({...editing,features_list:arr}); }} className="h-8 text-sm flex-1" />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive/60 hover:text-destructive"
                      onClick={() => setEditing({...editing,features_list:editing.features_list.filter((_,j)=>j!==i)})}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="gap-1.5 w-full mt-1"
                  onClick={() => setEditing({...editing,features_list:[...editing.features_list,""]})}>
                  <Plus className="h-4 w-4" /> Add Feature
                </Button>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 border-t border-border bg-card/90 backdrop-blur px-6 py-3 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving} className="bg-gradient-primary text-primary-foreground shadow-glow gap-2">
              {saving ? "Saving…" : "Save Plan"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div key={plan.id} className={`rounded-2xl border p-5 space-y-3 hover:shadow-glow transition-all duration-300 ${plan.is_active ? "border-border bg-card/60" : "border-border/40 bg-card/20 opacity-60"}`}>
              <div className="flex items-start justify-between">
                <div>
                  {planBadge(plan.slug)}
                  <div className="font-display font-bold text-2xl mt-2">PKR {plan.price_pkr}<span className="text-xs text-muted-foreground font-normal">/mo</span></div>
                  <div className="text-[11px] text-warning font-semibold">{plan.credits_per_month} credits/month</div>
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
              <div className="flex gap-1.5 flex-wrap">
                {plan.ai_enabled && <Badge className="bg-success/10 text-success border-0 text-[10px]">AI</Badge>}
                {plan.custom_branding && <Badge className="bg-primary/10 text-primary border-0 text-[10px]">Branding</Badge>}
                {plan.white_label && <Badge className="bg-purple-500/10 text-purple-600 border-0 text-[10px]">White Label</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CREDITS MANAGEMENT
// ═══════════════════════════════════════════════════════════════
function CreditsSection() {
  const { user: adminUser } = useAuth();
  type UserRow = { user_id: string; email: string; name: string; balance: number; total_earned: number; total_spent: number; plan_name: string };
  type TxRow = { id: string; user_id: string; type: string; amount: number; description: string | null; created_at: string; user_name: string };

  const [users, setUsers] = useState<UserRow[]>([]);
  const [txHistory, setTxHistory] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "deduct">("add");
  const [saving, setSaving] = useState(false);
  const [showTx, setShowTx] = useState(false);

  // Credit cost config per plan
  type CostRow = {
    id: string; name: string; slug: string;
    credit_cost_ai_10q: number; credit_cost_ai_scan: number;
    credit_cost_session_launch: number; credit_cost_export: number;
    credit_cost_extra_quiz: number; credit_cost_extra_participants: number;
  };
  const [costPlans, setCostPlans] = useState<CostRow[]>([]);
  const [editingCosts, setEditingCosts] = useState<CostRow | null>(null);
  const [savingCosts, setSavingCosts] = useState(false);

  const loadCosts = useCallback(async () => {
    const { data } = await supabase.from("plans")
      .select("id, name, slug, credit_cost_ai_10q, credit_cost_ai_scan, credit_cost_session_launch, credit_cost_export, credit_cost_extra_quiz, credit_cost_extra_participants")
      .order("sort_order");
    if (data) setCostPlans(data as CostRow[]);
  }, []);

  const saveCosts = async () => {
    if (!editingCosts) return;
    setSavingCosts(true);
    const { error } = await supabase.from("plans").update({
      credit_cost_ai_10q: editingCosts.credit_cost_ai_10q,
      credit_cost_ai_scan: editingCosts.credit_cost_ai_scan,
      credit_cost_session_launch: editingCosts.credit_cost_session_launch,
      credit_cost_export: editingCosts.credit_cost_export,
      credit_cost_extra_quiz: editingCosts.credit_cost_extra_quiz,
      credit_cost_extra_participants: editingCosts.credit_cost_extra_participants,
    }).eq("id", editingCosts.id);
    setSavingCosts(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Credit costs updated for ${editingCosts.name}`);
    setEditingCosts(null);
    void loadCosts();
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data: credits } = await supabase
      .from("user_credits")
      .select("user_id, balance, total_earned, total_spent")
      .order("balance", { ascending: false });

    if (!credits) { setLoading(false); return; }

    const userIds = credits.map((c) => c.user_id);
    const [profilesRes, subsRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").in("id", userIds),
      supabase.from("user_subscriptions").select("user_id, plans(name)").in("user_id", userIds).eq("status", "active"),
    ]);

    const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
    const subMap = new Map((subsRes.data ?? []).map((s) => [s.user_id, (s.plans as { name: string } | null)?.name ?? "Starter"]));

    setUsers(credits.map((c) => ({
      user_id: c.user_id,
      email: profileMap.get(c.user_id)?.email ?? c.user_id,
      name: profileMap.get(c.user_id)?.full_name ?? "Unknown",
      balance: c.balance,
      total_earned: c.total_earned,
      total_spent: c.total_spent,
      plan_name: subMap.get(c.user_id) ?? "Starter",
    })));
    setLoading(false);
  }, []);

  const loadTx = useCallback(async () => {
    const { data } = await supabase
      .from("credit_transactions")
      .select("id, user_id, type, amount, description, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!data) return;
    const ids = [...new Set(data.map((t) => t.user_id))];
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    const pMap = new Map((profs ?? []).map((p) => [p.id, p.full_name ?? "Unknown"]));
    setTxHistory(data.map((t) => ({ ...t, user_name: pMap.get(t.user_id) ?? t.user_id })));
  }, []);

  useEffect(() => { void load(); void loadTx(); void loadCosts(); }, [load, loadTx, loadCosts]);

  const handleAdjust = async () => {
    if (!selectedUser || !adjustAmount || !adminUser) return;
    const amt = parseInt(adjustAmount);
    if (isNaN(amt) || amt <= 0) { toast.error("Enter a valid positive amount"); return; }
    if (amt > 50000) { toast.error("Single adjustment capped at 50,000 credits"); return; }
    setSaving(true);
    try {
      const { data: ok, error } = await supabase.rpc("admin_adjust_credits", {
        p_user_id: selectedUser.user_id,
        p_amount: amt,
        p_direction: adjustType,
        p_description: adjustNote || `Admin ${adjustType === "add" ? "added" : "deducted"} ${amt} credits`,
      });
      if (error) throw error;
      if (!ok && adjustType === "deduct") { toast.error("Insufficient balance to deduct"); setSaving(false); return; }
      toast.success(`${adjustType === "add" ? "+" : "-"}${amt} credits ${adjustType === "add" ? "added to" : "deducted from"} ${selectedUser.name}`);
      setSelectedUser(null);
      setAdjustAmount("");
      setAdjustNote("");
      void load();
      void loadTx();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const TX_LABEL: Record<string, string> = {
    plan_refill: "Plan Refill", manual_topup: "Manual Top-up",
    payment_approved: "Payment Approved", ai_question_gen: "AI Question Gen",
    ai_image_scan: "AI Image Scan", admin_adjustment: "Admin Adjustment",
    extra_quiz: "Extra Quiz", extra_participants: "Extra Participants", expiry: "Expired",
  };

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Credits Management</h2>
          <p className="text-sm text-muted-foreground">View balances, manually add or deduct credits for any user</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowTx(!showTx)} className="gap-1.5">
            <TrendingUp className="h-4 w-4" /> {showTx ? "Hide" : "Show"} Transactions
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4 flex items-center gap-3">
          <Wallet className="h-8 w-8 text-warning/60" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Credits in Circulation</div>
            <div className="font-display text-2xl font-bold text-warning">{users.reduce((s, u) => s + u.balance, 0).toLocaleString()}</div>
          </div>
        </div>
        <div className="rounded-2xl border border-success/30 bg-success/5 p-4 flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-success/60" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Ever Earned</div>
            <div className="font-display text-2xl font-bold text-success">{users.reduce((s, u) => s + u.total_earned, 0).toLocaleString()}</div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card/60 p-4 flex items-center gap-3">
          <TrendingDown className="h-8 w-8 text-muted-foreground/60" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Ever Spent</div>
            <div className="font-display text-2xl font-bold">{users.reduce((s, u) => s + u.total_spent, 0).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search user..." className="pl-9" />
      </div>

      {/* Users credit table */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Balance</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Earned</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Spent</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users found</td></tr>
            ) : filtered.map((u) => (
              <tr key={u.user_id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">{u.plan_name}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-bold text-warning">{u.balance}</span>
                </td>
                <td className="px-4 py-3 text-right text-success text-xs">+{u.total_earned}</td>
                <td className="px-4 py-3 text-right text-muted-foreground text-xs">-{u.total_spent}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="default" className="h-7 px-2 text-[11px] gap-1 bg-success hover:bg-success/90 text-white"
                      onClick={() => { setSelectedUser(u); setAdjustType("add"); }}>
                      <PlusCircle className="h-3 w-3" /> Add
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 px-2 text-[11px] gap-1"
                      onClick={() => { setSelectedUser(u); setAdjustType("deduct"); }}>
                      <MinusCircle className="h-3 w-3" /> Deduct
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Adjust dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(o) => { if (!o) setSelectedUser(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {adjustType === "add"
                ? <><PlusCircle className="h-5 w-5 text-success" /> Add Credits</>
                : <><MinusCircle className="h-5 w-5 text-destructive" /> Deduct Credits</>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {selectedUser && (
              <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm">
                <div className="font-semibold">{selectedUser.name}</div>
                <div className="text-muted-foreground text-xs">{selectedUser.email}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Coins className="h-3.5 w-3.5 text-warning" />
                  <span className="text-warning font-bold">{selectedUser.balance} credits</span>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Amount (credits)
              </label>
              <Input
                type="number"
                min={1}
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="e.g. 100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Note (optional)
              </label>
              <Input
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder="Reason for adjustment..."
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" className="flex-1" onClick={() => setSelectedUser(null)} disabled={saving}>Cancel</Button>
              <Button
                className={`flex-1 gap-1 ${adjustType === "add" ? "bg-success hover:bg-success/90 text-white" : ""}`}
                variant={adjustType === "deduct" ? "destructive" : "default"}
                onClick={() => void handleAdjust()}
                disabled={saving || !adjustAmount}
              >
                {saving ? "Saving…" : adjustType === "add" ? `+${adjustAmount || 0} credits` : `-${adjustAmount || 0} credits`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction history */}
      {showTx && (
        <div className="rounded-2xl border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Recent Transactions (last 50)</span>
          </div>
          <div className="divide-y divide-border max-h-96 overflow-y-auto">
            {txHistory.map((tx) => {
              const isAdd = tx.amount > 0;
              return (
                <div key={tx.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors">
                  <div className={`rounded-lg p-1.5 shrink-0 ${isAdd ? "bg-success/15" : "bg-warning/15"}`}>
                    {isAdd ? <TrendingUp className="h-3.5 w-3.5 text-success" /> : <TrendingDown className="h-3.5 w-3.5 text-warning" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{tx.user_name}</div>
                    <div className="text-xs text-muted-foreground">{TX_LABEL[tx.type] ?? tx.type}{tx.description ? ` — ${tx.description}` : ""}</div>
                  </div>
                  <div className={`text-sm font-bold shrink-0 ${isAdd ? "text-success" : "text-warning"}`}>
                    {isAdd ? "+" : ""}{tx.amount}
                  </div>
                  <div className="text-[10px] text-muted-foreground shrink-0">{new Date(tx.created_at).toLocaleDateString()}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Credit cost configuration per plan */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Credit Cost Settings per Plan</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Click a row to edit, then save</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-muted/20 border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Plan</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">AI Gen<br/><span className="font-normal normal-case">per 10 Q</span></th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">AI Scan<br/><span className="font-normal normal-case">per image</span></th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Session<br/><span className="font-normal normal-case">launch</span></th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Export<br/><span className="font-normal normal-case">per report</span></th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Extra Quiz<br/><span className="font-normal normal-case">overage</span></th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Extra Ptcp<br/><span className="font-normal normal-case">overage</span></th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {costPlans.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground text-sm">Loading plans…</td></tr>
              ) : costPlans.map((plan) => {
                const isEditing = editingCosts?.id === plan.id;
                const row = isEditing ? editingCosts! : plan;
                const numInput = (field: keyof CostRow, label: string) => (
                  <input
                    type="number"
                    min={0}
                    aria-label={label}
                    value={row[field] as number}
                    readOnly={!isEditing}
                    onChange={(e) => isEditing && setEditingCosts({ ...editingCosts!, [field]: parseInt(e.target.value) || 0 })}
                    className={`w-16 text-center rounded-lg border px-2 py-1 text-sm font-semibold outline-none transition-colors
                      ${isEditing ? "border-primary bg-primary/5 focus:ring-2 focus:ring-primary/30" : "border-transparent bg-transparent text-foreground cursor-default"}`}
                  />
                );
                return (
                  <tr key={plan.id} className={`transition-colors ${isEditing ? "bg-primary/5" : "hover:bg-muted/20"}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{plan.name}</div>
                      <div className="text-[10px] text-muted-foreground">{plan.slug}</div>
                    </td>
                    <td className="px-3 py-3 text-center">{numInput("credit_cost_ai_10q", "AI gen per 10 questions")}</td>
                    <td className="px-3 py-3 text-center">{numInput("credit_cost_ai_scan", "AI scan per image")}</td>
                    <td className="px-3 py-3 text-center">{numInput("credit_cost_session_launch", "Session launch cost")}</td>
                    <td className="px-3 py-3 text-center">{numInput("credit_cost_export", "Export cost")}</td>
                    <td className="px-3 py-3 text-center">{numInput("credit_cost_extra_quiz", "Extra quiz overage")}</td>
                    <td className="px-3 py-3 text-center">{numInput("credit_cost_extra_participants", "Extra participants overage")}</td>
                    <td className="px-3 py-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 justify-center">
                          <Button size="sm" className="h-7 px-3 text-[11px] bg-success hover:bg-success/90 text-white"
                            onClick={() => void saveCosts()} disabled={savingCosts}>
                            {savingCosts ? "…" : "Save"}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]"
                            onClick={() => setEditingCosts(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 px-3 text-[11px] gap-1"
                          onClick={() => setEditingCosts({ ...plan })}>
                          <Edit2 className="h-3 w-3" /> Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 bg-muted/10 border-t border-border text-[10px] text-muted-foreground">
          AI Gen cost is per 10 questions; actual per-question cost is prorated (e.g. 5 questions at 10cr/10q = 5cr). Set 0 for free activities.
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MANUAL PAYMENTS (Finance)
// ═══════════════════════════════════════════════════════════════
function FinanceSection() {
  const { user } = useAuth();
  type PayRow = {
    id: string; user_id: string; user_name: string; user_email: string;
    plan_name: string; amount_pkr: number; payment_method: string;
    status: string; screenshot_url: string | null;
    credits_to_add: number; notes: string | null;
    created_at: string; reviewed_at: string | null;
  };
  const [payments, setPayments] = useState<PayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [actioning, setActioning] = useState<string | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("manual_payments")
      .select("*, plans(name)")
      .order("created_at", { ascending: false })
      .limit(300);
    if (!data?.length) { setLoading(false); return; }

    const userIds = [...new Set(data.map((p) => p.user_id))];
    const { data: profiles } = await supabase.from("profiles").select("id,full_name,email").in("id", userIds);
    const profMap: Record<string, { full_name: string | null; email: string | null }> = {};
    (profiles ?? []).forEach((p) => { profMap[p.id] = p; });

    setPayments(data.map((p) => ({
      id: p.id, user_id: p.user_id,
      user_name: profMap[p.user_id]?.full_name ?? "Unknown",
      user_email: profMap[p.user_id]?.email ?? "-",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plan_name: (p as any).plans?.name ?? "-",
      amount_pkr: p.amount_pkr, payment_method: p.payment_method,
      status: p.status, screenshot_url: p.screenshot_url ?? null,
      credits_to_add: p.credits_to_add, notes: p.notes ?? null,
      created_at: p.created_at, reviewed_at: p.reviewed_at ?? null,
    })));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleApprove = async (p: PayRow) => {
    setActioning(p.id);
    const { error } = await supabase.rpc("approve_payment", { p_payment_id: p.id, p_admin_id: user!.id });
    if (error) { toast.error("Failed: " + error.message); }
    else { toast.success(`Approved — ${p.credits_to_add} credits added to ${p.user_name}`); }
    setActioning(null);
    void load();
  };

  const handleReject = async (p: PayRow) => {
    setActioning(p.id);
    const { error } = await supabase
      .from("manual_payments")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", p.id);
    if (error) { toast.error("Failed: " + error.message); }
    else { toast.success("Payment rejected."); }
    setActioning(null);
    void load();
  };

  const filtered = statusFilter === "all" ? payments : payments.filter((p) => p.status === statusFilter);
  const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const approved = payments.filter((p) => p.status === "approved");
  const pending = payments.filter((p) => p.status === "pending");
  const revenue = approved.reduce((s, p) => s + p.amount_pkr, 0);
  const monthRevenue = approved.filter((p) => p.created_at >= thisMonth).reduce((s, p) => s + p.amount_pkr, 0);

  const exportCSV = () => {
    const csv = ["Date,User,Email,Plan,Amount PKR,Method,Status,Credits",
      ...filtered.map((p) => `${fmtDate(p.created_at)},${p.user_name},${p.user_email},${p.plan_name},${p.amount_pkr},${p.payment_method},${p.status},${p.credits_to_add}`)
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `payments_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const methodBadge = (m: string) => {
    const cfg: Record<string, string> = {
      easypaisa: "bg-[#00A850]/15 text-[#00A850]",
      jazzcash: "bg-[#D9232D]/15 text-[#D9232D]",
      bank_transfer: "bg-primary/15 text-primary",
    };
    const labels: Record<string, string> = { easypaisa: "EasyPaisa", jazzcash: "JazzCash", bank_transfer: "Bank" };
    return <Badge className={`${cfg[m] ?? "bg-muted/40 text-muted-foreground"} border-0 text-[10px]`}>{labels[m] ?? m}</Badge>;
  };

  const payStatusBadge = (s: string) => {
    const cfg: Record<string, string> = {
      pending: "bg-warning/15 text-warning",
      approved: "bg-success/15 text-success",
      rejected: "bg-destructive/15 text-destructive",
    };
    return <Badge className={`${cfg[s] ?? "bg-muted/40 text-muted-foreground"} border-0 text-[10px] capitalize`}>{s}</Badge>;
  };

  return (
    <div className="space-y-5">
      <SectionHead title="Payments" sub="Manual payment verification — approve or reject screenshot-based payments." />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Revenue (PKR)" value={`PKR ${revenue.toLocaleString()}`} icon={DollarSign} color="text-success" />
        <StatCard label="This Month (PKR)" value={`PKR ${monthRevenue.toLocaleString()}`} icon={Calendar} color="text-primary" />
        <StatCard label="Pending Review" value={pending.length} icon={AlertTriangle} color="text-warning" />
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><Filter className="h-4 w-4 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all","pending","approved","rejected"].map((s) => (
              <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => void load()} className="gap-1.5"><RefreshCw className="h-4 w-4" />Refresh</Button>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 ml-auto"><Download className="h-4 w-4" />Export CSV</Button>
      </div>

      {/* Table */}
      <TableShell footer={`${filtered.length} payment${filtered.length !== 1 ? "s" : ""}`}>
        <THead cols={["Date", "User", "Plan", "Amount", "Method", "Credits", "Status", "Actions"]} />
        <tbody className="divide-y divide-border/40">
          {loading ? <SkeletonRows cols={8} /> : filtered.length === 0 ? (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No payments found.</td></tr>
          ) : filtered.map((p) => (
            <tr key={p.id} className="hover:bg-muted/10 transition-colors">
              <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(p.created_at)}</td>
              <td className="px-4 py-3">
                <div className="text-xs font-medium">{p.user_name}</div>
                <div className="text-[11px] text-muted-foreground">{p.user_email}</div>
              </td>
              <td className="px-4 py-3 text-xs">{p.plan_name}</td>
              <td className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap">PKR {p.amount_pkr.toLocaleString()}</td>
              <td className="px-4 py-3">{methodBadge(p.payment_method)}</td>
              <td className="px-4 py-3 text-xs text-center">{p.credits_to_add}</td>
              <td className="px-4 py-3">{payStatusBadge(p.status)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {p.screenshot_url && (
                    <img
                      src="#"
                      alt="Payment proof"
                      className="h-14 w-14 object-cover rounded-md cursor-pointer border border-border hover:border-primary/60 transition-colors shrink-0"
                      onClick={async () => {
                        // Generate a short-lived signed URL (private bucket)
                        const { data } = await supabase.storage
                          .from("uploads")
                          .createSignedUrl(p.screenshot_url!, 300); // 5-min expiry
                        if (data?.signedUrl) setScreenshotUrl(data.signedUrl);
                      }}
                      onLoad={(e) => {
                        // Lazy-load signed URL on first render
                        const img = e.currentTarget;
                        if (img.src.endsWith("#")) {
                          supabase.storage.from("uploads")
                            .createSignedUrl(p.screenshot_url!, 300)
                            .then(({ data }) => { if (data?.signedUrl) img.src = data.signedUrl; });
                        }
                      }}
                    />
                  )}
                  {p.status === "pending" && (
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant="default" className="h-6 px-2 text-[11px] bg-success hover:bg-success/90 text-white gap-1"
                        disabled={actioning === p.id}
                        onClick={() => void handleApprove(p)}>
                        <CheckCircle className="h-3 w-3" />Approve
                      </Button>
                      <Button size="sm" variant="destructive" className="h-6 px-2 text-[11px] gap-1"
                        disabled={actioning === p.id}
                        onClick={() => void handleReject(p)}>
                        <X className="h-3 w-3" />Reject
                      </Button>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      {/* Screenshot preview dialog */}
      <Dialog open={!!screenshotUrl} onOpenChange={() => setScreenshotUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Payment Screenshot</DialogTitle></DialogHeader>
          {screenshotUrl && (
            <img src={screenshotUrl} alt="Payment proof" className="w-full rounded-lg object-contain max-h-[70vh]" />
          )}
        </DialogContent>
      </Dialog>
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
    return "-";
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
                  <button key={v} type="button" title={label} onClick={() => set("discount_type", v)}
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
      <h2 className="font-display text-lg md:text-xl font-bold leading-tight">{title}</h2>
      <p className="text-xs md:text-sm text-muted-foreground mt-1 leading-relaxed">{sub}</p>
    </div>
  );
}
