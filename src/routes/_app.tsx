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

  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  const isPaid = plan && plan.slug !== "individual_starter";

  return (
    <>
      {/* Subscription expired — hard block notice */}
      {isExpired && isPaid && (
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

      {/* Expiring soon warning */}
      {isExpiringSoon && !dismissedWarning && (
        <div className="bg-warning/90 text-warning-foreground px-3 sm:px-4 py-3 flex items-start sm:items-center gap-3">
          <Clock className="h-4 w-4 shrink-0" />
          <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">
            Your {plan?.name} plan expires in <strong>{daysUntilExpiry} day{daysUntilExpiry === 1 ? "" : "s"}</strong>. Renew now to avoid losing access.
          </div>
          <Link to="/billing" search={{ plan: "" }} className="shrink-0 rounded-lg bg-black/20 hover:bg-black/30 px-3 py-1.5 text-xs font-semibold transition-colors">
            Renew
          </Link>
          <button type="button" title="Dismiss" onClick={() => setDismissedWarning(true)} className="shrink-0 rounded p-1 hover:bg-black/20 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Free plan upsell — shown once, dismissible */}
      {!isPaid && !isExpired && !dismissedExpiry && (
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
