import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Settings, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";

type Props = {
  name: string;
  email: string;
  initials: string;
  avatarUrl?: string | null;
};

export function UserDropdown({ name, email, initials, avatarUrl }: Props) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl p-1 hover:bg-sidebar-accent transition-colors"
      >
        <Avatar className="size-9 border border-primary/30">
          {avatarUrl && <AvatarImage src={avatarUrl} />}
          <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-border bg-card/95 backdrop-blur shadow-card z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="font-semibold text-sm truncate">{name}</div>
            <div className="text-xs text-muted-foreground truncate mt-0.5">{email}</div>
          </div>
          <div className="p-1.5 space-y-0.5">
            <Link
              to="/settings"
              search={{ tab: "profile" }}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
            >
              <Settings className="size-4" />
              <span>Settings</span>
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-destructive/10 hover:text-destructive transition-colors w-full text-left"
            >
              <LogOut className="size-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
