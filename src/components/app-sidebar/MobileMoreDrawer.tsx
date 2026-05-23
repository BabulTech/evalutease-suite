import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import type { NavItem } from "./DesktopSidebar";

type Props = {
  items: NavItem[];
  pathname: string;
  onClose: () => void;
};

export function MobileMoreDrawer({ items, pathname, onClose }: Props) {
  return (
    <div className="md:hidden fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close more menu"
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-x-3 bottom-24 rounded-2xl border border-sidebar-border bg-sidebar p-3 shadow-card">
        <div className="flex items-center justify-between px-1 pb-2">
          <div>
            <div className="text-sm font-semibold text-sidebar-foreground">More</div>
            <div className="text-xs text-sidebar-foreground/60">Reports, billing, and settings</div>
          </div>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="size-9 rounded-xl hover:bg-sidebar-accent text-sidebar-foreground/70 inline-flex items-center justify-center"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {items.map(({ to, icon: Icon, label, badge = 0, special = false }) => {
            const active = pathname === to || pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                onClick={onClose}
                className={`relative min-h-16 rounded-xl border px-3 py-2.5 transition-colors flex items-center gap-3 ${
                  special
                    ? active
                      ? "border-destructive/30 bg-destructive/20 text-destructive"
                      : "border-destructive/20 text-destructive/80"
                    : active
                      ? "border-primary/35 bg-primary/15 text-primary"
                      : "border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground/80"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{label}</span>
                {badge > 0 && (
                  <span className="shrink-0 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
