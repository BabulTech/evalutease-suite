import { useRef, useState, useEffect } from "react";
import { Bell, CheckCheck, Info, AlertTriangle, XCircle, CheckCircle } from "lucide-react";
import { useNotifications, type Notification } from "@/contexts/NotificationContext";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const TYPE_ICON = {
  info: <Info className="size-3.5 text-blue-500" />,
  success: <CheckCircle className="size-3.5 text-green-500" />,
  warning: <AlertTriangle className="size-3.5 text-yellow-500" />,
  error: <XCircle className="size-3.5 text-red-500" />,
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleClick = async (n: Notification) => {
    if (!n.read) await markRead(n.id);
    if (n.link) {
      setOpen(false);
      navigate({ to: n.link as never });
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center size-9 rounded-xl hover:bg-sidebar-accent transition-colors"
        aria-label="Notifications"
      >
        <Bell className="size-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-border bg-card/95 backdrop-blur shadow-card z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="size-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full text-left px-4 py-3 hover:bg-sidebar-accent transition-colors flex items-start gap-3",
                    !n.read && "bg-primary/5",
                  )}
                >
                  <span className="mt-0.5 shrink-0">{TYPE_ICON[n.type]}</span>
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn("text-sm leading-snug truncate", !n.read && "font-semibold")}
                    >
                      {n.title}
                    </div>
                    {n.body && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.body}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                  {!n.read && <span className="mt-1.5 size-2 rounded-full bg-primary shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
