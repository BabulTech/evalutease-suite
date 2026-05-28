import { Link } from "@tanstack/react-router";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo } from "../Logo";

export type NavItem = {
  to: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
  special?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

type Props = {
  open: boolean;
  onToggle: () => void;
  groups: NavGroup[];
  pathname: string;
  logoUrl: string | null;
};

export function DesktopSidebar({ open, onToggle, groups, pathname, logoUrl }: Props) {
  return (
    <aside
      className={`hidden md:flex h-screen sticky top-0 shrink-0 flex-col border-e border-sidebar-border bg-sidebar transition-all duration-300 ${open ? "w-60" : "w-14"}`}
    >
      {/* Logo + toggle */}
      <div className={`flex items-center border-b border-sidebar-border h-14 shrink-0 ${open ? "px-3 justify-between" : "justify-center"}`}>
        {open && (
          <div className="px-1 min-w-0">
            <Logo customLogoUrl={logoUrl} />
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          title={open ? "Collapse sidebar" : "Expand sidebar"}
          className="p-2 rounded-xl hover:bg-sidebar-accent transition-colors text-sidebar-foreground/50 hover:text-sidebar-accent-foreground shrink-0"
        >
          {open ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-4 px-2">
        {groups.map((group, gi) => (
          <div key={group.label}>
            {/* Section label - hidden when collapsed */}
            {open && gi > 0 && (
              <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/35 select-none">
                {group.label}
              </p>
            )}
            {!open && gi > 0 && (
              <div className="mx-3 mb-2 border-t border-sidebar-border/50" />
            )}
            <div className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label, badge = 0, special = false }) => {
                const active = pathname === to || pathname.startsWith(to + "/");
                return (
                  <Link
                    key={to}
                    to={to}
                    title={!open ? (badge ? `${label} (${badge})` : label) : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all relative ${
                      special
                        ? active
                          ? "bg-destructive/20 text-destructive border border-destructive/30"
                          : "text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                        : active
                          ? "bg-primary/15 text-primary border border-primary/20 font-semibold"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <Icon className={`size-4 shrink-0 ${active && !special ? "text-primary" : ""}`} />
                    {open && <span className="truncate flex-1 leading-none">{label}</span>}
                    {badge > 0 && open && (
                      <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                        {badge}
                      </span>
                    )}
                    {badge > 0 && !open && (
                      <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-destructive" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
