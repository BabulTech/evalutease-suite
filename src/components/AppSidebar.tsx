import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderTree,
  UsersRound,
  PlayCircle,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";

export function AppSidebar() {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { to: "/categories", icon: FolderTree, label: t("nav.manageCategories") },
    { to: "/participant-types", icon: UsersRound, label: t("nav.manageParticipants") },
    { to: "/sessions", icon: PlayCircle, label: t("nav.sessions") },
    { to: "/reports", icon: BarChart3, label: t("nav.reports") },
    { to: "/settings", icon: Settings, label: t("nav.settings") },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <aside className="hidden md:flex h-screen sticky top-0 w-64 shrink-0 flex-col border-e border-sidebar-border bg-sidebar">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <Logo />
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                active
                  ? "bg-primary/15 text-primary border border-primary/25 shadow-glow"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <Button onClick={handleSignOut} variant="ghost" className="w-full justify-start gap-3">
          <LogOut className="h-4 w-4" />
          <span>{t("auth.logout")}</span>
        </Button>
      </div>
    </aside>
  );
}
