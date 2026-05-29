import { useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderTree,
  UsersRound,
  PlayCircle,
  BarChart3,
  Archive,
  Star,
  Shield,
  Coins,
  Building2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/contexts/ProfileContext";
import { usePlan } from "@/contexts/PlanContext";
import { useHost } from "@/contexts/HostContext";
import { DesktopSidebar, type NavGroup } from "./app-sidebar/DesktopSidebar";
import { MobileBottomNav } from "./app-sidebar/MobileBottomNav";
import { MobileMoreDrawer } from "./app-sidebar/MobileMoreDrawer";

type Props = { open: boolean; onToggle: () => void };

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

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const isEnterpriseAdmin = plan?.tier === "enterprise" && !isHost;
  const canSeeRequests = isEnterpriseAdmin && !!plan?.can_buy_credits;

  useEffect(() => {
    if (!user || !canSeeRequests) {
      setPendingReqCount(0);
      return;
    }
    let cancelled = false;
    const fetchCount = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- credit_requests table not yet in generated Supabase types
      const { count } = await (supabase as any)
        .from("credit_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (!cancelled) setPendingReqCount(count ?? 0);
    };
    void fetchCount();
    const interval = setInterval(() => void fetchCount(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, canSeeRequests]);

  const groups: NavGroup[] = [
    {
      label: "Home",
      items: [
        { to: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard"), shortLabel: "Home" },
      ],
    },
    {
      label: "Manage",
      items: [
        { to: "/categories", icon: FolderTree, label: t("nav.manageCategories"), shortLabel: "Quizzes" },
        { to: "/participant-types", icon: UsersRound, label: t("nav.manageParticipants"), shortLabel: "People" },
        { to: "/sessions", icon: PlayCircle, label: t("nav.sessions"), shortLabel: "Live" },
      ],
    },
    {
      label: "Track",
      items: [
        { to: "/quiz-history", icon: Archive, label: t("nav.quizHistory"), shortLabel: "Past" },
        { to: "/reports", icon: BarChart3, label: t("nav.reports"), shortLabel: "Stats" },
        { to: "/reviews", icon: Star, label: "Reviews", shortLabel: "Stars" },
      ],
    },
    {
      label: "Account",
      items: [
        ...(!["individual_starter", "enterprise_free"].includes(plan?.slug ?? "") || isHost
          ? [{ to: "/billing", icon: Coins, label: isHost ? "Credits" : "Billing", shortLabel: isHost ? "Credit" : "Bill" }]
          : []),
        ...(isEnterpriseAdmin
          ? [{ to: "/company", icon: Building2, label: "Org", shortLabel: "Org", badge: pendingReqCount }]
          : []),
        ...(isAdmin ? [{ to: "/admin", icon: Shield, label: "Admin", shortLabel: "Admin", special: true }] : []),
      ],
    },
  ].filter((g) => g.items.length > 0);

  const allItems = groups.flatMap((g) => g.items);
  const mobilePrimary = allItems.slice(0, 4);
  const mobileMore = allItems.slice(4);
  const isMoreActive = mobileMore.some(
    ({ to }) => pathname === to || pathname.startsWith(to + "/"),
  );

  return (
    <>
      <DesktopSidebar
        open={open}
        onToggle={onToggle}
        groups={groups}
        pathname={pathname}
        logoUrl={profile?.logo_url ?? null}
      />
      <MobileBottomNav
        primary={mobilePrimary}
        more={mobileMore}
        pathname={pathname}
        moreOpen={moreOpen}
        isMoreActive={isMoreActive}
        onMoreToggle={() => setMoreOpen((v) => !v)}
        onNavClick={() => setMoreOpen(false)}
      />
      {moreOpen && (
        <MobileMoreDrawer
          items={mobileMore}
          pathname={pathname}
          onClose={() => setMoreOpen(false)}
        />
      )}
    </>
  );
}
