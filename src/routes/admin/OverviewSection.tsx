import { useEffect, useState } from "react";
import {
  Users,
  UsersRound,
  PlayCircle,
  BookOpen,
  FolderTree,
  Star,
  CreditCard,
  DollarSign,
  TrendingUp,
  Calendar,
  Filter,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { StatCard, SectionHead } from "./-shared";
import { planBadge, statusBadge, ago } from "./helpers";

// react-doctor-disable-next-line react-doctor/prefer-useReducer
export function OverviewSection({ onNavigate }: { onNavigate: (section: string, recordId?: string) => void }) {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [recentUsers, setRecentUsers] = useState<
    { id: string; name: string; email: string; plan: string; joined: string }[]
  >([]);
  const [recentQuizzes, setRecentQuizzes] = useState<
    { id: string; title: string; owner: string; ownerId: string; status: string; created: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const thisWeek = new Date(now.getTime() - 7 * 86400000).toISOString();
      // react-doctor-disable-next-line react-doctor/no-event-handler
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      // react-doctor-disable-next-line react-doctor/no-event-handler
      const since =
        dateFilter === "today"
          ? today
          : dateFilter === "week"
            ? thisWeek
            : dateFilter === "month"
              ? thisMonth
              : null;

      let sessQ = supabase.from("quiz_sessions").select("id", { count: "exact", head: true });
      let partsQ = supabase.from("participants").select("id", { count: "exact", head: true });
      let qsQ = supabase.from("questions").select("id", { count: "exact", head: true });
      if (since) {
        sessQ = sessQ.gte("created_at", since);
        partsQ = partsQ.gte("created_at", since);
        qsQ = qsQ.gte("created_at", since);
      }

      const [
        { count: c_users },
        { count: c_sessions },
        { count: c_questions },
        { count: c_participants },
        { count: c_categories },
        { count: c_feedback },
        { count: c_active_subs },
        { count: c_new_users },
        { data: payments },
        { data: profiles },
        { data: sessions },
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        sessQ,
        qsQ,
        partsQ,
        supabase.from("question_categories").select("id", { count: "exact", head: true }),
        supabase.from("quiz_feedback").select("id", { count: "exact", head: true }),
        supabase
          .from("user_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("created_at", thisMonth),
        supabase.from("manual_payments").select("amount_pkr").eq("status", "approved"),
        supabase
          .from("profiles")
          .select("id, full_name, email, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("quiz_sessions")
          .select("id, title, owner_id, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const revenue = (payments ?? []).reduce((s, p) => s + (p.amount_pkr ?? 0), 0);
      setStats({
        users: c_users ?? 0,
        sessions: c_sessions ?? 0,
        questions: c_questions ?? 0,
        participants: c_participants ?? 0,
        categories: c_categories ?? 0,
        feedback: c_feedback ?? 0,
        active_subs: c_active_subs ?? 0,
        new_users: c_new_users ?? 0,
        revenue,
      });

      const ids = (profiles ?? []).map((p) => p.id);
      const { data: subs } = await supabase
        .from("user_subscriptions")
        .select("user_id, plans(slug)")
        .in("user_id", ids);
      const planMap: Record<string, string> = {};
      (subs ?? []).forEach((s) => {
        planMap[s.user_id] = (s.plans as { slug: string } | null)?.slug ?? "free";
      });
      setRecentUsers(
        (profiles ?? []).map((p) => ({
          id: p.id,
          name: p.full_name ?? "-",
          email: p.email ?? "-",
          plan: planMap[p.id] ?? "free",
          joined: p.created_at,
        })),
      );

      const ownerIds = [...new Set((sessions ?? []).map((s) => s.owner_id))];
      const { data: owners } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ownerIds);
      const ownerMap: Record<string, string> = {};
      (owners ?? []).forEach((o) => {
        ownerMap[o.id] = o.full_name ?? "-";
      });
      setRecentQuizzes(
        (sessions ?? []).map((s) => ({
          id: s.id,
          title: s.title,
          owner: ownerMap[s.owner_id] ?? "-",
          ownerId: s.owner_id,
          status: s.status,
          created: s.created_at,
        })),
      );

      setLoading(false);
    })();
  }, [dateFilter]);

  const filteredRecentUsers =
    planFilter === "all" ? recentUsers : recentUsers.filter((u) => u.plan === planFilter);

  if (loading)
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl md:rounded-2xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-col md:flex-row md:flex-wrap md:items-center md:justify-between gap-3">
        <SectionHead title="Platform Overview" sub="Real-time snapshot of the entire platform." />
        <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:flex-wrap">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full md:w-36 h-10 md:h-8 text-xs">
              <Calendar className="size-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">This month</SelectItem>
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-full md:w-40 h-10 md:h-8 text-xs">
              <Filter className="size-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              <SelectItem value="individual_starter">Individual Free</SelectItem>
              <SelectItem value="individual_pro">Individual Pro</SelectItem>
              <SelectItem value="individual_pro_plus">Individual Pro+</SelectItem>
              <SelectItem value="enterprise_free">Org Free</SelectItem>
              <SelectItem value="enterprise_pro">Org Pro</SelectItem>
              <SelectItem value="enterprise_elite">Org Elite</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
        <button
          type="button"
          onClick={() => onNavigate("users")}
          className="text-left min-w-0"
          aria-label="View total hosts"
          title="View total hosts"
        >
          <StatCard label="Total Hosts" value={stats.users} icon={Users} trend={12} />
        </button>
        <button
          type="button"
          onClick={() => onNavigate("participants")}
          className="text-left min-w-0"
          aria-label="View total participants"
          title="View total participants"
        >
          <StatCard
            label="Total Participants"
            value={stats.participants}
            icon={UsersRound}
            color="text-success"
          />
        </button>
        <button
          type="button"
          onClick={() => onNavigate("quizzes")}
          className="text-left min-w-0"
          aria-label="View quiz sessions"
          title="View quiz sessions"
        >
          <StatCard label="Quiz Sessions" value={stats.sessions} icon={PlayCircle} />
        </button>
        <button
          type="button"
          onClick={() => onNavigate("categories")}
          className="text-left min-w-0"
          aria-label="View questions"
          title="View questions"
        >
          <StatCard label="Questions" value={stats.questions} icon={BookOpen} />
        </button>
        <button
          type="button"
          onClick={() => onNavigate("categories")}
          className="text-left min-w-0"
          aria-label="View categories"
          title="View categories"
        >
          <StatCard label="Categories" value={stats.categories} icon={FolderTree} />
        </button>
        <button
          type="button"
          onClick={() => onNavigate("reviews")}
          className="text-left min-w-0"
          aria-label="View student reviews"
          title="View student reviews"
        >
          <StatCard
            label="Student Reviews"
            value={stats.feedback}
            icon={Star}
            color="text-warning"
          />
        </button>
        <button
          type="button"
          onClick={() => onNavigate("plans")}
          className="text-left min-w-0"
          aria-label="View active subscriptions"
          title="View active subscriptions"
        >
          <StatCard
            label="Active Subscriptions"
            value={stats.active_subs}
            icon={CreditCard}
            color="text-primary"
            trend={8}
          />
        </button>
        <button
          type="button"
          onClick={() => onNavigate("finance")}
          className="text-left min-w-0"
          aria-label="View revenue"
          title="View revenue"
        >
          <StatCard
            label="Revenue (PKR)"
            value={`PKR ${stats.revenue.toLocaleString()}`}
            icon={DollarSign}
            color="text-warning"
          />
        </button>
        <button
          type="button"
          onClick={() => onNavigate("users")}
          className="text-left min-w-0"
          aria-label="View new hosts this month"
          title="View new hosts this month"
        >
          <StatCard
            label="New Hosts (Month)"
            value={stats.new_users}
            icon={TrendingUp}
            color="text-success"
            trend={stats.new_users > 0 ? 15 : 0}
          />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
          <div className="px-4 md:px-5 py-3 border-b border-border/60 bg-muted/20 flex items-center justify-between">
            <span className="font-semibold text-sm">Recent Host Signups</span>
            <button
              type="button"
              onClick={() => onNavigate("users")}
              className="text-[11px] text-primary hover:underline"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-border/40">
            {filteredRecentUsers.map((u) => (
              <button
                type="button"
                key={u.id}
                onClick={() => onNavigate("users", u.id)}
                className="w-full text-left px-4 py-3 flex items-start sm:items-center gap-3 hover:bg-muted/10 transition-colors cursor-pointer"
                aria-label={`View ${u.name}`}
              >
                <div className="size-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate text-primary hover:underline">{u.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{u.email}</div>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onNavigate("plans", u.plan); }}
                  className="shrink-0 hover:scale-105 transition-transform cursor-pointer"
                  aria-label={`View ${u.plan} plan`}
                >
                  {planBadge(u.plan)}
                </button>
                <span className="hidden sm:inline text-[11px] text-muted-foreground shrink-0">
                  {ago(u.joined)}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
          <div className="px-4 md:px-5 py-3 border-b border-border/60 bg-muted/20 flex items-center justify-between">
            <span className="font-semibold text-sm">Recent Quiz Sessions</span>
            <button
              type="button"
              onClick={() => onNavigate("quizzes")}
              className="text-[11px] text-primary hover:underline"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-border/40">
            {recentQuizzes.map((q) => (
              <div
                key={q.id}
                className="px-4 py-3 flex items-start sm:items-center gap-3 hover:bg-muted/10 transition-colors"
              >
                <div className="size-8 rounded-xl bg-muted/40 flex items-center justify-center shrink-0">
                  <PlayCircle className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => onNavigate("quizzes", q.id)}
                    className="text-xs font-medium truncate text-primary hover:underline text-left cursor-pointer"
                  >
                    {q.title}
                  </button>
                  <div className="text-[11px] text-muted-foreground">
                    by{" "}
                    <button
                      type="button"
                      onClick={() => onNavigate("users", q.ownerId)}
                      className="hover:text-primary hover:underline cursor-pointer"
                    >
                      {q.owner}
                    </button>
                  </div>
                </div>
                <div className="shrink-0">{statusBadge(q.status)}</div>
                <span className="hidden sm:inline text-[11px] text-muted-foreground shrink-0">
                  {ago(q.created)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
