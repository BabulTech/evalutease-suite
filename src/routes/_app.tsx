import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { FeedbackButton } from "@/components/FeedbackButton";
import { PlanProvider } from "@/contexts/PlanContext";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login" });
    }
  },
  component: AppLayout,
});

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
    <PlanProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar open={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onMenuClick={() => setSidebarOpen((v) => !v)} />
          <main className="flex-1 p-4 md:p-8">
            <Outlet />
          </main>
          <FeedbackButton />
        </div>
      </div>
    </PlanProvider>
  );
}
