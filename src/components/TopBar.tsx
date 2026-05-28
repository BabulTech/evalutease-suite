import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useProfile } from "@/contexts/ProfileContext";
import { usePlan } from "@/contexts/PlanContext";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { NotificationBell } from "./NotificationBell";
import { UserDropdown } from "./top-bar/UserDropdown";

function FreeAiBadge() {
  const { user } = useAuth();
  const { plan } = usePlan();
  const [used, setUsed] = useState<number | null>(null);
  const isFreeAi = plan?.slug === "enterprise_free";
  const limit = plan?.trial_ai_calls ?? 10;

  useEffect(() => {
    if (!isFreeAi || !user?.id) { setUsed(null); return; }

    const refresh = async () => {
      // The plan_owner_id is the user themselves for solo accounts,
      // OR their org admin if they're a company member.
      // Query by their own id first (covers solo case); falls through to
      // 0 if no row yet (no AI calls made).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("trial_ai_usage")
        .select("used_calls")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        console.warn("[FreeAiBadge] fetch error:", error.message);
      }
      setUsed(data?.used_calls ?? 0);
    };
    void refresh();

    // 1) Postgres-changes Realtime (when client mutates the row)
    const channel = supabase
      .channel(`free-ai-badge:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trial_ai_usage", filter: `user_id=eq.${user.id}` },
        () => void refresh(),
      )
      .subscribe();

    // 2) Custom window event fired by AiTab after each successful generation
    const onConsumed = () => void refresh();
    window.addEventListener("free-ai-consumed", onConsumed);

    // 3) Refresh when the tab regains focus (covers cases where the server
    //    updated the row while user was on another tab/window)
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    // 4) Safety poll every 15 s - picks up any updates we missed
    const interval = setInterval(() => void refresh(), 15000);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener("free-ai-consumed", onConsumed);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      clearInterval(interval);
    };
  }, [isFreeAi, user?.id]);

  if (!isFreeAi) return null;
  const remaining = Math.max(0, limit - (used ?? 0));
  const isLow = remaining <= 2;

  return (
    <Link
      to="/billing"
      search={{ plan: "" }}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold transition-colors ${
        isLow
          ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
          : "bg-success/10 text-success hover:bg-success/15"
      }`}
      title="Free AI calls remaining - click to upgrade"
      aria-label={`${remaining} of ${limit} free AI calls remaining`}
    >
      <Sparkles size={12} />
      <span className="sm:hidden">{remaining}/{limit}</span>
      <span className="hidden sm:inline">{remaining} / {limit} free AI {remaining === 0 ? "(upgrade)" : "left"}</span>
    </Link>
  );
}

type Props = { onMenuClick?: () => void };

export function TopBar(_props: Props) {
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
    <header className="h-14 md:h-16 sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border flex items-center justify-between px-3 sm:px-4 md:px-8 gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="text-sm text-muted-foreground truncate min-w-0">
          <span className="hidden sm:inline">{t("dash.welcome")},</span>{" "}
          <span className="font-medium text-foreground">{name}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <FreeAiBadge />
        {/* <LanguageSwitcher /> */}
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
