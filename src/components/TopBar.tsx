import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useProfile } from "@/contexts/ProfileContext";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NotificationBell } from "./NotificationBell";
import { UserDropdown } from "./top-bar/UserDropdown";

type Props = { onMenuClick?: () => void };

export function TopBar({ onMenuClick }: Props) {
  const { user } = useAuth();
  const { t } = useI18n();
  const { profile } = useProfile();

  const name =
    profile?.full_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    user?.email?.split("@")[0] ||
    "User";
  const email = user?.email ?? "";
  const initials = name.slice(0, 2).toUpperCase();

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
        <NotificationBell />
        <UserDropdown
          name={name}
          email={email}
          initials={initials}
          avatarUrl={profile?.avatar_url}
        />
      </div>
    </header>
  );
}
