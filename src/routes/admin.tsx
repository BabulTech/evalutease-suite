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
          {section === "overview"     && <OverviewSection />}
          {section === "users"        && <UsersSection />}
          {section === "participants" && <ParticipantsSection />}
          {section === "quizzes"      && <QuizzesSection />}
          {section === "categories"   && <CategoriesSection />}
          {section === "reviews"      && <ReviewsSection />}
          {section === "appfeedback"  && <AppFeedbackSection onCountChange={setFeedbackBadge} />}
          {section === "plans"        && <PlansSection />}
          {section === "finance"      && <FinanceSection />}
        </main>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// OVERVIEW
// ═══════════════════════════════════════════════════════════════
function OverviewSection() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [recentUsers, setRecentUsers] = useState<{ name: string; email: string; plan: string; joined: string }[]>([]);
  const [recentQuizzes, setRecentQuizzes] = useState<{ title: string; owner: string; status: string; created: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [
        { count: c_users }, { count: c_sessions }, { count: c_questions },
        { count: c_participants }, { count: c_categories }, { count: c_feedback },
        { count: c_active_subs }, { count: c_new_users },
        { data: payments }, { data: profiles }, { data: sessions },
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("quiz_sessions").select("id", { count: "exact", head: true }),
        supabase.from("questions").select("id", { count: "exact", head: true }),
        supabase.from("participants").select("id", { count: "exact", head: true }),
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
  }, []);

  if (loading) return <div className="grid grid-cols-3 gap-4">{Array.from({length:9}).map((_,i)=><div key={i} className="h-28 rounded-2xl bg-muted/30 animate-pulse" />)}</div>;

  return (
    <div className="space-y-6">
      <SectionHead title="Platform Overview" sub="Real-time snapshot of the entire platform." />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard label="Total Hosts" value={stats.users} icon={Users} trend={12} />
        <StatCard label="Total Participants" value={stats.participants} icon={UsersRound} color="text-success" />
        <StatCard label="Quiz Sessions" value={stats.sessions} icon={PlayCircle} />
        <StatCard label="Questions" value={stats.questions} icon={BookOpen} />
        <StatCard label="Categories" value={stats.categories} icon={FolderTree} />
        <StatCard label="Student Reviews" value={stats.feedback} icon={Star} color="text-warning" />
        <StatCard label="Active Subscriptions" value={stats.active_subs} icon={CreditCard} color="text-primary" trend={8} />
        <StatCard label="Revenue" value={fmt$(stats.revenue)} icon={DollarSign} color="text-warning" />
        <StatCard label="New Hosts (Month)" value={stats.new_users} icon={TrendingUp} color="text-success" trend={stats.new_users > 0 ? 15 : 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent signups */}
        <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
          <div className="px-5 py-3 border-b border-border/60 bg-muted/20 flex items-center justify-between">
            <span className="font-semibold text-sm">Recent Host Signups</span>
          </div>
          <div className="divide-y divide-border/40">
            {recentUsers.map((u, i) => (
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
          <div className="px-5 py-3 border-b border-border/60 bg-muted/20">
            <span className="font-semibold text-sm">Recent Quiz Sessions</span>
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
// USERS (HOSTS)
// ═══════════════════════════════════════════════════════════════
function UsersSection() {
  type Row = {
    id: string; full_name: string | null; email: string | null;
    organization: string | null; country: string | null; mobile: string | null;
    created_at: string; plan_slug: string; sub_status: string;
    session_count: number; question_count: number; participant_count: number;
  };
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [detail, setDetail] = useState<Row | null>(null);

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

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Host Details</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center text-primary font-bold text-xl">
                  {(detail.full_name ?? "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold">{detail.full_name ?? "—"}</div>
                  <div className="text-sm text-muted-foreground">{detail.email ?? "—"}</div>
                  <div className="mt-1">{planBadge(detail.plan_slug)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Organization", detail.organization],
                  ["Country", detail.country],
                  ["Mobile", detail.mobile],
                  ["Joined", fmtDate(detail.created_at)],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-xl border border-border bg-card/30 p-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{l}</div>
                    <div className="font-medium text-xs">{v ?? "—"}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Sessions", detail.session_count, PlayCircle],
                  ["Questions", detail.question_count, BookOpen],
                  ["Participants", detail.participant_count, UsersRound],
                ].map(([l, v, Icon]) => (
                  <div key={l as string} className="rounded-xl border border-border bg-card/30 p-3 text-center">
                    <div className="font-display text-xl font-bold text-primary">{v as number}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{l as string}</div>
                  </div>
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

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: parts } = await supabase.from("participants")
        .select("id,name,email,mobile,owner_id,subtype_id,created_at")
        .order("created_at", { ascending: false }).limit(200);
      if (!parts?.length) { setLoading(false); return; }

      const ownerIds = [...new Set(parts.map((p) => p.owner_id))];
      const subtypeIds = [...new Set(parts.map((p) => p.subtype_id).filter(Boolean))] as string[];
      const partIds = parts.map((p) => p.id);

      const [{ data: owners }, { data: subtypes }, { data: attempts }] = await Promise.all([
        supabase.from("profiles").select("id,full_name").in("id", ownerIds),
        supabase.from("participant_subtypes").select("id,name").in("id", subtypeIds),
        supabase.from("quiz_attempts").select("participant_id,score,total_questions,completed_at")
          .in("participant_id", partIds).not("completed_at", "is", null),
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
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => [r.name, r.email, r.owner_name, r.subtype].some((v) => v?.toLowerCase().includes(q)));
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <SectionHead title="Participants" sub={`${rows.length} participants across all hosts.`} />
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search name, email, host…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      <TableShell footer={`${filtered.length} of ${rows.length} participants`}>
        <THead cols={["Participant", "Host", "Group", "Quizzes Taken", "Avg Score", "Added"]} />
        <tbody className="divide-y divide-border/40">
          {loading ? <SkeletonRows cols={6} /> : filtered.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No participants found.</td></tr>
          ) : filtered.map((r) => (
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
      stripe_price_id_monthly: editing.stripe_price_id_monthly,
      stripe_price_id_yearly: editing.stripe_price_id_yearly,
      limits: editing.limits, features: editing.features,
    }).eq("id", editing.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Plan saved");
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

            {/* Stripe IDs */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-6 w-1 rounded-full bg-warning" />
                <span className="text-sm font-semibold">Stripe Integration</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-muted-foreground mb-1 block">Price ID — Monthly</label>
                  <Input placeholder="price_xxx" value={editing.stripe_price_id_monthly ?? ""} onChange={(e) => setEditing({ ...editing, stripe_price_id_monthly: e.target.value })} className="font-mono text-xs" /></div>
                <div><label className="text-xs text-muted-foreground mb-1 block">Price ID — Yearly</label>
                  <Input placeholder="price_xxx" value={editing.stripe_price_id_yearly ?? ""} onChange={(e) => setEditing({ ...editing, stripe_price_id_yearly: e.target.value })} className="font-mono text-xs" /></div>
              </div>
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
function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-2">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <p className="text-sm text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}
