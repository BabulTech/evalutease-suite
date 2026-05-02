import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

export function TopBar() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user]);

  const name = profile?.full_name || user?.email?.split("@")[0] || "User";
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <header className="h-16 sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border flex items-center justify-between px-4 md:px-8">
      <div className="text-sm text-muted-foreground">
        <span className="hidden sm:inline">{t("dash.welcome")},</span>{" "}
        <span className="font-medium text-foreground">{name}</span>
      </div>
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <Avatar className="h-9 w-9 border border-primary/30">
          {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
          <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
