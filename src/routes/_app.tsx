import { Outlet, createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
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

  const isTrial = plan?.slug === "enterprise_starter";
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  const isFree = plan?.slug === "individual_starter" || plan?.slug === "enterprise_free";

  return (
    <>
      {/* Subscription expired — hard block notice */}
      {isExpired && !isFree && (
        <div className="bg-destructive text-destructive-foreground px-3 sm:px-4 py-3 flex items-start sm:items-center gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">
            Your subscription has expired. You've been moved to the Free plan — upgrade to restore access.
          </div>
          <Link to="/billing" search={{ plan: "" }} className="shrink-0 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-semibold transition-colors">
            Renew Now
          </Link>
        </div>
      )}

      {/* Trial active — always show days remaining */}
      {isTrial && !isExpired && daysUntilExpiry !== null && !dismissedWarning && (
        <div className="bg-yellow-500/15 border-b border-yellow-500/25 px-3 sm:px-4 py-2.5 flex items-start sm:items-center gap-3">
          <Clock className="h-4 w-4 text-yellow-400 shrink-0" />
          <div className="flex-1 text-xs text-yellow-300 font-medium leading-relaxed">
            🎉 Enterprise Trial — <strong>{daysUntilExpiry} day{daysUntilExpiry === 1 ? "" : "s"} remaining</strong>. Upgrade to Enterprise Pro to keep full access after trial ends.
          </div>
          <Link to="/billing" search={{ plan: "" }} className="shrink-0 rounded-lg bg-yellow-400 text-black px-3 py-1.5 text-xs font-semibold hover:bg-yellow-300 transition-colors">
            Upgrade
          </Link>
          <button type="button" title="Dismiss" onClick={() => setDismissedWarning(true)} className="shrink-0 rounded p-1 hover:bg-yellow-400/20 transition-colors text-yellow-400">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Trial expiring soon — extra urgent warning */}
      {isTrial && isExpiringSoon && !dismissedWarning && (
        <div className="bg-warning/90 text-warning-foreground px-3 sm:px-4 py-3 flex items-start sm:items-center gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">
            ⚠️ Trial expires in <strong>{daysUntilExpiry} day{daysUntilExpiry === 1 ? "" : "s"}</strong>! Upgrade now to avoid losing AI access and team tools.
          </div>
          <Link to="/billing" search={{ plan: "" }} className="shrink-0 rounded-lg bg-black/20 hover:bg-black/30 px-3 py-1.5 text-xs font-semibold transition-colors">
            Upgrade Now
          </Link>
        </div>
      )}

      {/* Free plan upsell — shown once, dismissible */}
      {isFree && !isExpired && !dismissedExpiry && (
        <div className="bg-primary/10 border-b border-primary/20 px-3 sm:px-4 py-2.5 flex items-start sm:items-center gap-3">
          <Zap className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 text-xs text-primary font-medium leading-relaxed">
            You're on the Free plan — AI features, more quizzes, and team tools are available on Pro.
          </div>
          <Link to="/billing" search={{ plan: "" }} className="shrink-0 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:bg-primary/90 transition-colors">
            Upgrade
          </Link>
          <button type="button" title="Dismiss" onClick={() => setDismissedExpiry(true)} className="shrink-0 rounded p-1 hover:bg-primary/20 transition-colors text-primary">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}

function AppLayout() {
  const { loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
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
                <Outlet />
              </main>
            </div>
          </div>
        </div>
      </PlanProvider>
    </HostProvider>
  );
}
