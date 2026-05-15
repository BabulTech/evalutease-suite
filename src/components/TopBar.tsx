import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useProfile } from "@/contexts/ProfileContext";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Settings, LogOut } from "lucide-react";

type Props = { onMenuClick?: () => void };

export function TopBar({ onMenuClick }: Props) {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const name = profile?.full_name
    || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ")
    || user?.email?.split("@")[0]
    || "User";
  const email = user?.email ?? "";
  const initials = name.slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <header className="h-16 sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border flex items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="hidden p-2 rounded-lg hover:bg-sidebar-accent transition-colors"
          >
            <span className="sr-only">Open menu</span>
          </button>
        )}
        <div className="text-sm text-muted-foreground">
          <span className="hidden sm:inline">{t("dash.welcome")},</span>{" "}
          <span className="font-medium text-foreground">{name}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <LanguageSwitcher />

        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 rounded-xl p-1 hover:bg-sidebar-accent transition-colors"
          >
            <Avatar className="h-9 w-9 border border-primary/30">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
              <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-border bg-card/95 backdrop-blur shadow-card z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <div className="font-semibold text-sm truncate">{name}</div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{email}</div>
              </div>
              <div className="p-1.5 space-y-0.5">
                <Link
                  to="/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-destructive/10 hover:text-destructive transition-colors w-full text-left"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
