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
} from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  open: boolean;
  onToggle: () => void;
};

export function AppSidebar({ open, onToggle }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const items = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard") },
    { to: "/categories", icon: FolderTree, label: t("nav.manageCategories") },
    { to: "/participant-types", icon: UsersRound, label: t("nav.manageParticipants") },
    { to: "/sessions", icon: PlayCircle, label: t("nav.sessions") },
    { to: "/quiz-history", icon: Archive, label: t("nav.quizHistory") },
    { to: "/reports", icon: BarChart3, label: t("nav.reports") },
    { to: "/reviews", icon: Star, label: "Reviews" },
    ...(isAdmin ? [{ to: "/admin", icon: Shield, label: "Admin", special: true }] : []),
  ];

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
              <Logo />
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
            return (
              <Link
                key={to}
                to={to}
                title={!open ? label : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all group ${
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
                {open && <span className="font-medium truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile overlay sidebar */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onToggle}
          />
          <aside className="relative z-10 w-64 h-full flex flex-col border-e border-sidebar-border bg-sidebar">
            <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
              <Logo />
              <button
                type="button"
                onClick={onToggle}
                className="p-2 rounded-xl hover:bg-sidebar-accent transition-colors"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {items.map(({ to, icon: Icon, label, ...rest }) => {
                const active = pathname === to || pathname.startsWith(to + "/");
                const special = "special" in rest && rest.special;
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={onToggle}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                      special
                        ? active
                          ? "bg-destructive/20 text-destructive border border-destructive/30"
                          : "text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                        : active
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
          </aside>
        </div>
      )}
    </>
  );
}
