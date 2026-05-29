import React from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  DollarSign,
  Shield,
  MoreHorizontal,
  Activity,
  Zap,
  UsersRound,
  FolderTree,
  PlayCircle,
  MessageSquare,
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Globe,
  Tag,
  Coins,
  Wallet,
  Star,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/NotificationBell";

import { OverviewSection } from "./admin/OverviewSection";
import { AnalyticsSection } from "./admin/AnalyticsSection";
import { UsersSection } from "./admin/UsersSection";
import { ParticipantsSection } from "./admin/ParticipantsSection";
import { QuizzesSection } from "./admin/QuizzesSection";
import { CategoriesSection } from "./admin/CategoriesSection";
import { ReviewsSection } from "./admin/ReviewsSection";
import { AppFeedbackSection } from "./admin/AppFeedbackSection";
import { ActivityLogsSection } from "./admin/ActivityLogsSection";
import { AiUsageSection } from "./admin/AiUsageSection";
import { SecurityAlertsSection } from "./admin/SecurityAlertsSection";
import { PlansSection } from "./admin/PlansSection";
import { CreditsSection } from "./admin/CreditsSection";
import { CreditPackagesSection } from "./admin/CreditPackagesSection";
// import { BlockedDomainsSection } from "./admin/BlockedDomainsSection";
import { PromoCodesSection } from "./admin/PromoCodesSection";
import { FinanceSection } from "./admin/FinanceSection";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>) => ({
    section: typeof search.section === "string" ? search.section : undefined,
  }),
  component: AdminPage,
});

type NavItem = { key: string; label: string; icon: React.ElementType; badge?: number };

const NAV: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "analytics", label: "Analytics", icon: TrendingUp },
  { key: "users", label: "Users", icon: Users },
  { key: "participants", label: "Participants", icon: UsersRound },
  { key: "quizzes", label: "Quizzes", icon: PlayCircle },
  { key: "categories", label: "Categories", icon: FolderTree },
  { key: "reviews", label: "Reviews", icon: Star },
  { key: "appfeedback", label: "App Feedback", icon: MessageSquare },
  { key: "activity", label: "Activity Logs", icon: Activity },
  { key: "aiusage", label: "AI Usage", icon: Zap },
  { key: "alerts", label: "Security Alerts", icon: AlertTriangle },
  { key: "plans", label: "Plans", icon: CreditCard },
  { key: "credits", label: "Credits", icon: Coins },
  { key: "packages", label: "Credit Packages", icon: Wallet },
  // { key: "domains", label: "Blocked Domains", icon: Globe },
  { key: "promocodes", label: "Promo Codes", icon: Tag },
  { key: "finance", label: "Finance", icon: DollarSign },
];

const NAV_GROUPS = [
  { key: "overview", label: "Overview", shortLabel: "Home",   icon: LayoutDashboard, sections: ["overview"] },
  { key: "people",   label: "People",   shortLabel: "People", icon: Users,           sections: ["users", "participants"] },
  { key: "content",  label: "Content",  shortLabel: "Quiz",   icon: PlayCircle,      sections: ["quizzes", "categories"] },
  { key: "feedback", label: "Feedback", shortLabel: "Feed",   icon: MessageSquare,   sections: ["reviews", "appfeedback"] },
  { key: "monitor",  label: "Monitor",  shortLabel: "Audit",  icon: Activity,        sections: ["analytics", "activity", "aiusage", "alerts"] },
  {
    key: "money",
    label: "Money",
    shortLabel: "Money",
    icon: Wallet,
    sections: ["plans", "credits", "packages", "domains", "promocodes", "finance"],
  },
] as const;

function getNavGroup(section: string) {
  return (
    NAV_GROUPS.find((g) => (g.sections as readonly string[]).includes(section)) ?? NAV_GROUPS[0]
  );
}

// react-doctor-disable-next-line react-doctor/prefer-useReducer
// react-doctor-disable-next-line react-doctor/only-export-components
function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { section: sectionParam } = useSearch({ from: "/admin" });
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [section, setSection] = useState(sectionParam ?? "overview");
  const [transitioning, setTransitioning] = useState(false);

  // Sync section when URL param changes (e.g. from notification link)
  useEffect(() => {
    if (sectionParam && sectionParam !== section) {
      handleSetSection(sectionParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionParam]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSetSection = (key: string, recordId?: string) => {
    if (recordId) {
      // Persist the selected record id in the URL so the target section can pick it up.
      const params = new URLSearchParams(window.location.search);
      params.set("section", key);
      params.set("id", recordId);
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    }
    if (key === section) return;
    setTransitioning(true);
    setSection(key);
    setTimeout(() => setTransitioning(false), 180);
  };
  const [feedbackBadge, setFeedbackBadge] = useState(0);
  const [alertBadge, setAlertBadge] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  // react-doctor-disable-next-line react-doctor/no-cascading-set-state
  useEffect(() => {
    if (!user) {
      void navigate({ to: "/login" });
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          toast.error("Access denied - admins only");
          void navigate({ to: "/dashboard" });
          return;
        }
        setIsAdmin(true);
        supabase
          .from("app_feedback")
          .select("id", { count: "exact", head: true })
          .eq("status", "open")
          .then(({ count }) => setFeedbackBadge(count ?? 0));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("security_alerts")
          .select("id", { count: "exact", head: true })
          .eq("status", "open")
          .then(({ count }: { count: number | null }) => setAlertBadge(count ?? 0));
      });
  }, [user, navigate]);

  if (isAdmin === null)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm animate-pulse">
        Verifying admin access…
      </div>
    );

  const navItems: NavItem[] = NAV.map((n) =>
    n.key === "appfeedback" && feedbackBadge > 0
      ? { ...n, badge: feedbackBadge }
      : n.key === "alerts" && alertBadge > 0
        ? { ...n, badge: alertBadge }
        : n,
  );
  const activeItem = navItems.find((item) => item.key === section) ?? navItems[0];
  const activeGroup = getNavGroup(section);
  const mobileSubNav = activeGroup.sections.flatMap((key) => {
    const item = navItems.find((it) => it.key === key);
    return item ? [item] : [];
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card/90 backdrop-blur sticky top-0 z-50 p-3 sm:px-4 flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="rounded-xl bg-gradient-primary p-1.5 shadow-glow">
            <Shield className="size-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <span className="block font-display font-bold leading-tight truncate">
              Admin Dashboard
            </span>
            <span className="block md:hidden text-[11px] text-muted-foreground truncate">
              {activeItem.label}
            </span>
          </div>
          <Badge className="hidden sm:inline-flex bg-destructive/15 text-destructive border-0 text-[10px]">
            ADMIN
          </Badge>
        </div>
        <div className="ml-auto">
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void navigate({ to: "/dashboard" })}
              className="h-9 px-2 sm:px-3"
            >
              ← Back to App
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile sub-nav chips */}
      <div className="md:hidden sticky top-[57px] z-40 border-b border-border bg-background/95 backdrop-blur px-3 py-2">
        <div className="flex items-center flex-wrap gap-2 pb-1">
          {mobileSubNav.map(({ key, label, icon: Icon, badge }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleSetSection(key)}
              className={`min-h-11 shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors inline-flex items-center gap-2 ${
                section === key
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border bg-card/50 text-muted-foreground"
              }`}
            >
              <Icon className="size-4" />
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
        <aside
          className={`${sidebarOpen ? "w-56" : "w-14"} hidden md:flex shrink-0 border-r border-border bg-card/40 transition-all duration-300 flex-col`}
        >
          {/* Sidebar toggle header - matches app sidebar pattern */}
          <div className={`flex items-center border-b border-border/60 h-11 shrink-0 ${sidebarOpen ? "px-3 justify-between" : "justify-center"}`}>
            {sidebarOpen && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 select-none px-1">
                Navigation
              </span>
            )}
            <button
              type="button"
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              onClick={() => setSidebarOpen((v) => !v)}
              className="p-2 rounded-xl hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground shrink-0"
            >
              {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-4 px-2">
            {[
              {
                label: "Overview",
                color: "text-primary",
                items: navItems.filter((n) => ["overview"].includes(n.key)),
              },
              {
                label: "People",
                color: "text-blue-400",
                items: navItems.filter((n) => ["users", "participants"].includes(n.key)),
              },
              {
                label: "Content",
                color: "text-success",
                items: navItems.filter((n) => ["quizzes", "categories", "reviews", "appfeedback"].includes(n.key)),
              },
              {
                label: "Monitor",
                color: "text-warning",
                items: navItems.filter((n) => ["analytics", "activity", "aiusage", "alerts"].includes(n.key)),
              },
              {
                label: "Monetize",
                color: "text-purple-400",
                items: navItems.filter((n) => ["plans", "credits", "packages", "promocodes", "finance"].includes(n.key)),
              },
            ].map((group, gi) => (
              <div key={group.label}>
                {sidebarOpen ? (
                  <p className={`px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest ${group.color} opacity-60 select-none`}>
                    {group.label}
                  </p>
                ) : gi > 0 ? (
                  <div className="mx-3 mb-2 border-t border-border/40" />
                ) : null}
                <div className="space-y-0.5">
                  {group.items.map(({ key, label, icon: Icon, badge }) => (
                    <button
                      key={key}
                      type="button"
                      title={!sidebarOpen ? (badge ? `${label} (${badge})` : label) : undefined}
                      onClick={() => handleSetSection(key)}
                      className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all relative ${
                        section === key
                          ? "bg-primary/15 text-primary border border-primary/20 font-semibold"
                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                      }`}
                    >
                      <Icon className={`size-4 shrink-0 ${section === key ? "text-primary" : ""}`} />
                      {sidebarOpen && (
                        <span className="truncate flex-1 text-left leading-none">{label}</span>
                      )}
                      {sidebarOpen && badge ? (
                        <span className="ml-auto rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center">
                          {badge}
                        </span>
                      ) : null}
                      {!sidebarOpen && badge ? (
                        <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-destructive" />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-3 py-4 pb-28 sm:p-5 md:pb-5">
          {transitioning ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-10 rounded-xl bg-muted/40 w-1/3" />
              <div className="h-20 rounded-xl bg-muted/30" />
              <div className="h-64 rounded-xl bg-muted/40" />
              <div className="h-40 rounded-xl bg-muted/30" />
            </div>
          ) : (
            <>
              {section === "overview" && <OverviewSection onNavigate={handleSetSection} />}
              {section === "analytics" && <AnalyticsSection />}
              {section === "users" && <UsersSection />}
              {section === "participants" && <ParticipantsSection />}
              {section === "quizzes" && <QuizzesSection />}
              {section === "categories" && <CategoriesSection />}
              {section === "reviews" && <ReviewsSection />}
              {section === "appfeedback" && <AppFeedbackSection onCountChange={setFeedbackBadge} />}
              {section === "activity" && <ActivityLogsSection />}
              {section === "aiusage" && <AiUsageSection />}
              {section === "alerts" && <SecurityAlertsSection onOpenCountChange={setAlertBadge} />}
              {section === "plans" && <PlansSection />}
              {section === "credits" && <CreditsSection />}
              {section === "packages" && <CreditPackagesSection />}
              {/* {section === "domains" && <BlockedDomainsSection />} */}
              {section === "promocodes" && <PromoCodesSection />}
              {section === "finance" && <FinanceSection />}
            </>
          )}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur px-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <div className="grid grid-cols-5 gap-0.5">
          {NAV_GROUPS.slice(0, 4).map(({ key, label, shortLabel, icon: Icon, sections }) => {
            const selected = (sections as readonly string[]).includes(section);
            const target = sections[0];
            const groupBadge = (sections as readonly string[]).includes("appfeedback")
              ? feedbackBadge
              : (sections as readonly string[]).includes("alerts")
                ? alertBadge
                : 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  handleSetSection(target);
                  setMoreOpen(false);
                }}
                aria-label={label}
                title={label}
                className={`relative min-h-14 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition-colors flex flex-col items-center justify-center gap-1 ${
                  selected
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                <Icon className="size-5" />
                <span className="leading-none truncate max-w-full">{shortLabel ?? label}</span>
                {groupBadge > 0 && (
                  <span className="absolute right-2 top-1.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-1.5 py-0.5">
                    {groupBadge}
                  </span>
                )}
              </button>
            );
          })}
          {(() => {
            const moreGroups = NAV_GROUPS.slice(4);
            const isMoreActive = moreGroups.some((g) =>
              (g.sections as readonly string[]).includes(section),
            );
            const moreBadge = moreGroups.some(
              (g) =>
                ((g.sections as readonly string[]).includes("appfeedback") && feedbackBadge > 0) ||
                ((g.sections as readonly string[]).includes("alerts") && alertBadge > 0),
            );
            return (
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className={`relative min-h-14 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition-colors flex flex-col items-center justify-center gap-1 ${
                  isMoreActive || moreOpen
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                <MoreHorizontal className="size-5" />
                <span className="leading-none">More</span>
                {moreBadge && (
                  <span className="absolute right-2 top-1.5 size-2 rounded-full bg-destructive" />
                )}
              </button>
            );
          })()}
        </div>
      </nav>

      {/* "More" overlay */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close more menu"
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-3 bottom-24 rounded-2xl border border-border bg-card p-3 shadow-card">
            <div className="flex items-center justify-between px-1 pb-2">
              <div>
                <div className="text-sm font-semibold">More</div>
                <div className="text-xs text-muted-foreground">Monitoring and money</div>
              </div>
              <button
                type="button"
                title="Close"
                onClick={() => setMoreOpen(false)}
                className="size-9 rounded-xl hover:bg-muted/40 text-muted-foreground inline-flex items-center justify-center"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {NAV_GROUPS.slice(4).map(({ key, label, icon: Icon, sections }) => {
                const selected = (sections as readonly string[]).includes(section);
                const target = sections[0];
                const groupBadge = (sections as readonly string[]).includes("appfeedback")
                  ? feedbackBadge
                  : (sections as readonly string[]).includes("alerts")
                    ? alertBadge
                    : 0;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      handleSetSection(target);
                      setMoreOpen(false);
                    }}
                    className={`relative min-h-16 rounded-xl border px-3 py-2.5 transition-colors flex items-center gap-3 ${
                      selected
                        ? "border-primary/35 bg-primary/15 text-primary"
                        : "border-border bg-muted/20 text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 text-sm font-medium text-left">{label}</span>
                    {groupBadge > 0 && (
                      <span className="shrink-0 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5">
                        {groupBadge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
