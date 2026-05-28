import { Outlet, createFileRoute, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PlanProvider, usePlan } from "@/contexts/PlanContext";
import { HostProvider, useHost } from "@/contexts/HostContext";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, X, Zap, Clock } from "lucide-react";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login" });
    }
  },
  component: AppLayout,
});

function PlanBanners() {
  const { isExpired, plan, billingCycle, expiresAt, yearlyDiscountPercent } = usePlan();
  const { isHost, loading: hostLoading } = useHost();
  const [dismissedFree, setDismissedFree] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem("banner_free_dismissed") === "1",
  );
  const [dismissedMonthly, setDismissedMonthly] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem("banner_monthly_dismissed") === "1",
  );
  const [dismissedYearly, setDismissedYearly] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem("banner_yearly_dismissed") === "1",
  );

  // Hosts never see plan banners; don't flash while we resolve
  if (hostLoading || isHost) return null;

  const isFree = plan?.slug === "individual_starter" || plan?.slug === "enterprise_free";
  const isPaidActive = plan && !isFree && !isExpired;
  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;
  const monthlyPrice = plan?.price_pkr ?? 0;
  const yearlySavings = monthlyPrice > 0 && yearlyDiscountPercent > 0
    ? (monthlyPrice * 12) - Math.round(monthlyPrice * 12 * (1 - yearlyDiscountPercent / 100))
    : 0;

  return (
    <>
      {/* Subscription expired, hard block notice */}
      {isExpired && !isFree && (
        <div className="bg-destructive text-destructive-foreground p-3 sm:px-4 flex items-start sm:items-center gap-3">
          <AlertTriangle className="size-4 shrink-0" />
          <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">
            Your subscription has expired. You've been moved to the Free plan, upgrade to restore
            access.
          </div>
          <Link
            to="/billing"
            search={{ plan: "" }}
            className="shrink-0 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            Renew Now
          </Link>
        </div>
      )}

      {/* Yearly subscriber: info banner with expiry month/year */}
      {isPaidActive && billingCycle === "yearly" && expiryLabel && !dismissedYearly && (
        <div className="bg-emerald-400/10 border-b border-emerald-400/20 px-3 sm:px-4 py-2.5 flex items-start sm:items-center gap-3">
          <Clock className="size-4 text-emerald-400 shrink-0" />
          <div className="flex-1 text-xs text-emerald-400 font-medium leading-relaxed">
            You're on the <strong>Yearly</strong> {plan.name} plan. Subscription expires{" "}
            <strong>{expiryLabel}</strong>.
          </div>
          <button
            type="button"
            title="Dismiss"
            onClick={() => {
              setDismissedYearly(true);
              sessionStorage.setItem("banner_yearly_dismissed", "1");
            }}
            className="shrink-0 rounded p-1 hover:bg-emerald-400/20 transition-colors text-emerald-400"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Monthly subscriber: upsell to yearly */}
      {isPaidActive && billingCycle === "monthly" && yearlySavings > 0 && !dismissedMonthly && (
        <div className="bg-primary/10 border-b border-primary/20 px-3 sm:px-4 py-2.5 flex items-start sm:items-center gap-3">
          <Zap className="size-4 text-primary shrink-0" />
          <div className="flex-1 text-xs text-primary font-medium leading-relaxed">
            You're on <strong>Monthly</strong> {plan.name}. Switch to yearly and save{" "}
            <strong>PKR {yearlySavings.toLocaleString()}/year</strong> ({yearlyDiscountPercent}% off).
          </div>
          <Link
            to="/billing"
            search={{ plan: plan.slug, cycle: "yearly" }}
            className="shrink-0 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            Get Yearly
          </Link>
          <button
            type="button"
            title="Dismiss"
            onClick={() => {
              setDismissedMonthly(true);
              sessionStorage.setItem("banner_monthly_dismissed", "1");
            }}
            className="shrink-0 rounded p-1 hover:bg-primary/20 transition-colors text-primary"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Free plan upsell, shown once, dismissible */}
      {isFree && !isExpired && !dismissedFree && (
        <div className="bg-primary/10 border-b border-primary/20 px-3 sm:px-4 py-2.5 flex items-start sm:items-center gap-3">
          <Zap className="size-4 text-primary shrink-0" />
          <div className="flex-1 text-xs text-primary font-medium leading-relaxed">
            You're on the Free plan, AI features, more quizzes, and team tools are available on Pro.
          </div>
          <Link
            to="/billing"
            search={{ plan: "" }}
            className="shrink-0 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            Upgrade
          </Link>
          <button
            type="button"
            title="Dismiss"
            onClick={() => {
              setDismissedFree(true);
              sessionStorage.setItem("banner_free_dismissed", "1");
            }}
            className="shrink-0 rounded p-1 hover:bg-primary/20 transition-colors text-primary"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </>
  );
}

function AppLayout() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isNavigating = useRouterState({ select: (s) => s.status === "pending" });
  const navigate = useNavigate();
  const hadUser = useRef(false);
  const pushInitedFor = useRef<string | null>(null);

  // Detect when an active session is invalidated (user deleted by admin)
  useEffect(() => {
    if (!loading && user) hadUser.current = true;
    if (!loading && !user && hadUser.current) {
      toast.error("Your account no longer exists. Please contact support.");
      void navigate({ to: "/login" });
    }
  }, [user, loading, navigate]);

  // Initialise native push notifications once per authenticated session,
  // only when running inside the Capacitor shell. No-op on the web.
  useEffect(() => {
    if (!user || pushInitedFor.current === user.id) return;
    pushInitedFor.current = user.id;
    void import("@/lib/push").then(({ initPushNotifications, isNativePlatform }) => {
      if (!isNativePlatform()) return;
      void initPushNotifications((link) => {
        // Deep-link from a tapped OS notification. Use direct location change
        // so any path / query string from the server works without TanStack
        // Router's compile-time path checks.
        window.location.href = link;
      });
    });
  }, [user, navigate]);

  // Periodically verify the session is still valid (catches deleted users +
  // post-network-blip 401s faster). Run on visibilitychange too so a tab
  // resuming from sleep gets validated immediately.
  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      if (cancelled) return;
      const { error } = await supabase.auth.getUser();
      if (cancelled) return;
      // Only treat AuthApiError (token expired/invalid) as terminal —
      // ignore transient network failures so a flaky connection doesn't
      // log the user out.
      if (error && (error as { name?: string }).name === "AuthApiError") {
        await supabase.auth.signOut();
        toast.error("Your session is no longer valid. Please sign in again.");
        void navigate({ to: "/login" });
      }
    };
    const interval = setInterval(verify, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") void verify(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="size-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }
  return (
    <HostProvider>
      <PlanProvider>
        <div className="min-h-screen flex flex-col w-full">
          <div className="flex flex-1 min-h-0">
            <AppSidebar open={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />
            <div className="flex-1 flex flex-col min-w-0">
              <TopBar onMenuClick={() => setSidebarOpen((v) => !v)} />
              <PlanBanners />
              <main className="flex-1 px-3 py-4 pb-24 sm:p-5 md:p-8 md:pb-8">
                {isNavigating ? <PageSkeleton /> : <Outlet />}
              </main>
            </div>
          </div>
        </div>
      </PlanProvider>
    </HostProvider>
  );
}
