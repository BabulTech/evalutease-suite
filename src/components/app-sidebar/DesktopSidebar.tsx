import { Link } from "@tanstack/react-router";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo } from "../Logo";

type NavItem = {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
  special?: boolean;
};

type Props = {
  open: boolean;
  onToggle: () => void;
  items: NavItem[];
  pathname: string;
  logoUrl: string | null;
};

export function DesktopSidebar({ open, onToggle, items, pathname, logoUrl }: Props) {
  return (
    <aside
      className={`hidden md:flex h-screen sticky top-0 shrink-0 flex-col border-e border-sidebar-border bg-sidebar transition-all duration-300 ${open ? "w-64" : "w-16"}`}
    >
      <div className="flex items-center justify-between px-3 py-5 border-b border-sidebar-border">
        {open && (
          <div className="px-2">
            <Logo customLogoUrl={logoUrl} />
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="p-2 rounded-xl hover:bg-sidebar-accent transition-colors text-sidebar-foreground/70 hover:text-sidebar-accent-foreground ml-auto"
        >
          {open ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
        </button>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
        {items.map(({ to, icon: Icon, label, badge = 0, special = false }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              title={!open ? (badge ? `${label} (${badge})` : label) : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all group relative ${
                special
                  ? active
                    ? "bg-destructive/20 text-destructive border border-destructive/30"
                    : "text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                  : active
                    ? "bg-primary/15 text-primary border border-primary/25 shadow-glow"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-glow"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {open && <span className="font-medium truncate flex-1">{label}</span>}
              {badge > 0 && open && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  {badge}
                </span>
              )}
              {badge > 0 && !open && (
                <span className="absolute top-1 right-1 size-2 rounded-full bg-destructive" />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export type { NavItem };
