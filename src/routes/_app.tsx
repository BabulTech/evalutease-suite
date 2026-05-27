import { Outlet, createFileRoute, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
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
  const { isExpired, daysUntilExpiry, plan } = usePlan();
  const { isHost, loading: hostLoading } = useHost();
  const [dismissedExpiry, setDismissedExpiry] = useState(false);
  const [dismissedWarning, setDismissedWarning] = useState(false);

  // Hosts never see plan banners; don't flash while we resolve
  if (hostLoading || isHost) return null;

  const isFree = plan?.slug === "individual_starter" || plan?.slug === "enterprise_free";

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


      {/* Free plan upsell, shown once, dismissible */}
      {isFree && !isExpired && !dismissedExpiry && (
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
            onClick={() => setDismissedExpiry(true)}
            className="shrink-0 rounded p-1 hover:bg-primary/20 transition-colors text-primary"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-24 rounded-xl md:rounded-2xl bg-muted/40" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-20 rounded-xl bg-muted/30" />
        <div className="h-20 rounded-xl bg-muted/30" />
        <div className="h-20 rounded-xl bg-muted/30" />
      </div>
      <div className="h-64 rounded-xl md:rounded-2xl bg-muted/40" />
      <div className="h-40 rounded-xl md:rounded-2xl bg-muted/30" />
    </div>
  );
}

function AppLayout() {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const isNavigating = useRouterState({ select: (s) => s.status === "pending" });
  const navigate = useNavigate();
  const hadUser = useRef(false);

  // Detect when an active session is invalidated (user deleted by admin)
  useEffect(() => {
    if (!loading && user) hadUser.current = true;
    if (!loading && !user && hadUser.current) {
      toast.error("Your account no longer exists. Please contact support.");
      void navigate({ to: "/login" });
    }
  }, [user, loading, navigate]);

  // Periodically verify the session is still valid (catches deleted users faster)
  useEffect(() => {
    const interval = setInterval(async () => {
      const { error } = await supabase.auth.getUser();
      if (error) {
        await supabase.auth.signOut();
        toast.error("Your session is no longer valid.");
        void navigate({ to: "/login" });
      }
    }, 60_000); // check every 60 seconds
    return () => clearInterval(interval);
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
