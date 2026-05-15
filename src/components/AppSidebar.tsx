import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderTree,
  UsersRound,
  PlayCircle,
  BarChart3,
  Archive,
  Star,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  Coins,
  Building2,
  MoreHorizontal,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/contexts/ProfileContext";
import { usePlan } from "@/contexts/PlanContext";
import { useHost } from "@/contexts/HostContext";

type Props = {
  open: boolean;
  onToggle: () => void;
};

export function AppSidebar({ open, onToggle }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { plan } = usePlan();
  const { isHost } = useHost();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingReqCount, setPendingReqCount] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const logoUrl = profile?.logo_url ?? null;

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  // Enterprise admin (not a host) sees "My Organization"
  const isEnterpriseAdmin = plan?.tier === "enterprise" && !isHost;

  // Fetch pending credit-request count for enterprise admins
  useEffect(() => {
    if (!user || !isEnterpriseAdmin) { setPendingReqCount(0); return; }
    let cancelled = false;
    const fetchCount = async () => {
      const { count } = await (supabase as any)
        .from("credit_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (!cancelled) setPendingReqCount(count ?? 0);
    };
    void fetchCount();
    // Re-poll every 30s so badge stays fresh
    const interval = setInterval(() => void fetchCount(), 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user, isEnterpriseAdmin]);

  const items = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { to: "/categories", icon: FolderTree, label: t("nav.manageCategories") },
    { to: "/participant-types", icon: UsersRound, label: t("nav.manageParticipants") },
    { to: "/sessions", icon: PlayCircle, label: t("nav.sessions") },
    { to: "/quiz-history", icon: Archive, label: t("nav.quizHistory") },
    { to: "/reports", icon: BarChart3, label: t("nav.reports") },
    { to: "/reviews", icon: Star, label: "Reviews" },
    { to: "/billing", icon: Coins, label: isHost ? "My Credits" : "Credits & Billing" },
    ...(isEnterpriseAdmin
      ? [{ to: "/company", icon: Building2, label: "My Organization", badge: pendingReqCount }]
      : []),
    ...(isAdmin ? [{ to: "/admin", icon: Shield, label: "Admin", special: true }] : []),
  ];
  const mobilePrimary = items.slice(0, 4);
  const mobileMore = items.slice(4);
  const isMoreActive = mobileMore.some(({ to }) => pathname === to || pathname.startsWith(to + "/"));

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex h-screen sticky top-0 shrink-0 flex-col border-e border-sidebar-border bg-sidebar transition-all duration-300 ${
          open ? "w-64" : "w-16"
        }`}
      >
        <div className="flex items-center justify-between px-3 py-5 border-b border-sidebar-border">
          {open && (
            <div className="px-2">
              <Logo customLogoUrl={logoUrl} />
            </div>
          )}
          <button
            type="button"
            onClick={onToggle}
            className="p-2 rounded-xl hover:bg-sidebar-accent transition-colors text-sidebar-foreground/70 hover:text-sidebar-accent-foreground ml-auto"
          >
            {open ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {items.map(({ to, icon: Icon, label, ...rest }) => {
            const active = pathname === to || pathname.startsWith(to + "/");
            const special = "special" in rest && rest.special;
            const badge = ("badge" in rest && typeof rest.badge === "number" && rest.badge > 0) ? rest.badge : 0;
            return (
              <Link
                key={to}
                to={to}
                title={!open ? `${label}${badge ? ` (${badge})` : ""}` : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all group relative ${
                  special
                    ? active
                      ? "bg-destructive/20 text-destructive border border-destructive/30"
                      : "text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                    : active
                    ? "bg-primary/15 text-primary border border-primary/25 shadow-glow"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-glow"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {open && <span className="font-medium truncate flex-1">{label}</span>}
                {badge > 0 && open && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                    {badge}
                  </span>
                )}
                {badge > 0 && !open && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-sidebar-border bg-sidebar/95 backdrop-blur px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-5 gap-1">
          {mobilePrimary.map(({ to, icon: Icon, label, ...rest }) => {
            const active = pathname === to || pathname.startsWith(to + "/");
            const badge = ("badge" in rest && typeof rest.badge === "number" && rest.badge > 0) ? rest.badge : 0;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setMoreOpen(false)}
                className={`relative min-h-14 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition-colors flex flex-col items-center justify-center gap-1 ${
                  active ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="leading-none truncate max-w-full">{label}</span>
                {badge > 0 && <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-destructive" />}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className={`relative min-h-14 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition-colors flex flex-col items-center justify-center gap-1 ${
              isMoreActive || moreOpen ? "bg-primary/15 text-primary" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="leading-none">More</span>
            {mobileMore.some((item) => "badge" in item && typeof item.badge === "number" && item.badge > 0) && (
              <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-destructive" />
            )}
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close more menu"
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-3 bottom-24 rounded-2xl border border-sidebar-border bg-sidebar p-3 shadow-card">
            <div className="flex items-center justify-between px-1 pb-2">
              <div>
                <div className="text-sm font-semibold text-sidebar-foreground">More</div>
                <div className="text-xs text-sidebar-foreground/60">Reports, billing, and settings</div>
              </div>
              <button
                type="button"
                title="Close"
                onClick={() => setMoreOpen(false)}
                className="h-9 w-9 rounded-xl hover:bg-sidebar-accent text-sidebar-foreground/70 inline-flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {mobileMore.map(({ to, icon: Icon, label, ...rest }) => {
                const active = pathname === to || pathname.startsWith(to + "/");
                const special = "special" in rest && rest.special;
                const badge = ("badge" in rest && typeof rest.badge === "number" && rest.badge > 0) ? rest.badge : 0;
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMoreOpen(false)}
                    className={`relative min-h-16 rounded-xl border px-3 py-2.5 transition-colors flex items-center gap-3 ${
                      special
                        ? active
                          ? "border-destructive/30 bg-destructive/20 text-destructive"
                          : "border-destructive/20 text-destructive/80"
                        : active
                        ? "border-primary/35 bg-primary/15 text-primary"
                        : "border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground/80"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{label}</span>
                    {badge > 0 && (
                      <span className="shrink-0 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
