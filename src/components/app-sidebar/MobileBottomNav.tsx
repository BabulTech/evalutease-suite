import { Link } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import type { NavItem } from "./DesktopSidebar";

type Props = {
  primary: NavItem[];
  more: NavItem[];
  pathname: string;
  moreOpen: boolean;
  isMoreActive: boolean;
  onMoreToggle: () => void;
  onNavClick: () => void;
};

export function MobileBottomNav({
  primary,
  more,
  pathname,
  moreOpen,
  isMoreActive,
  onMoreToggle,
  onNavClick,
}: Props) {
  const hasMoreBadge = more.some((item) => (item.badge ?? 0) > 0);
  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-50 border-t border-sidebar-border bg-sidebar/95 backdrop-blur px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="grid grid-cols-5 gap-1">
        {primary.map(({ to, icon: Icon, label, shortLabel, badge = 0 }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          // Mobile shows the short label (≤6 chars, first word). Falls back to
          // the first word of the full label, truncated.
          const compact = shortLabel ?? label.split(" ")[0].slice(0, 6);
          return (
            <Link
              key={to}
              to={to}
              onClick={onNavClick}
              className={`relative min-h-14 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition-colors flex flex-col items-center justify-center gap-1 ${
                active
                  ? "bg-primary/15 text-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
              aria-label={label}
              title={label}
            >
              <Icon className="size-5" />
              <span className="leading-none truncate max-w-full">{compact}</span>
              {badge > 0 && (
                <span className="absolute right-2 top-1.5 size-2 rounded-full bg-destructive" />
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMoreToggle}
          className={`relative min-h-14 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition-colors flex flex-col items-center justify-center gap-1 ${
            isMoreActive || moreOpen
              ? "bg-primary/15 text-primary"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }`}
        >
          <MoreHorizontal className="size-5" />
          <span className="leading-none">More</span>
          {hasMoreBadge && (
            <span className="absolute right-2 top-1.5 size-2 rounded-full bg-destructive" />
          )}
        </button>
      </div>
    </nav>
  );
}
