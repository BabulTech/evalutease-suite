import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { usePlan } from "@/contexts/PlanContext";
import { useHost } from "@/contexts/HostContext";
import { HostDashboard } from "./dashboard/HostDashboard";
import { OwnerDashboard } from "./dashboard/OwnerDashboard";
import { useDashboardData } from "./dashboard/useDashboardData";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/_app/dashboard")({ component: DashboardPage });

// react-doctor-disable-next-line react-doctor/only-export-components
function DashboardPage() {
  const { user } = useAuth();
  const { plan, loading: planLoading } = usePlan();
  const { hostInfo, loading: hostLoading } = useHost();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.user_metadata?.first_name ?? user?.email?.split("@")[0] ?? "there";

  const { stats, recent, credits } = useDashboardData(user, plan, hostLoading || !!hostInfo);

  if (hostLoading) return null;
  if (hostInfo) return <HostDashboard host={hostInfo} userId={user!.id} />;

  return (
    <OwnerDashboard
      plan={plan}
      planLoading={planLoading}
      stats={stats}
      recent={recent}
      credits={credits}
      firstName={firstName}
      greeting={greeting}
    />
  );
}
