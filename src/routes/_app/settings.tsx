import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [profile, setProfile] = useState({
    first_name: "", last_name: "", organization: "", mobile: "", country: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) setProfile({
        first_name: data.first_name ?? "",
        last_name: data.last_name ?? "",
        organization: data.organization ?? "",
        mobile: data.mobile ?? "",
        country: data.country ?? "",
      });
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setLoading(true);
    const full_name = `${profile.first_name} ${profile.last_name}`.trim();
    const { error } = await supabase.from("profiles").update({ ...profile, full_name }).eq("id", user.id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">{t("nav.settings")}</h1>
        <p className="text-muted-foreground mt-1">Update your profile and preferences.</p>
      </div>
      <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="mb-1.5">{t("auth.firstName")}</Label>
            <Input value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} /></div>
          <div><Label className="mb-1.5">{t("auth.lastName")}</Label>
            <Input value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} /></div>
        </div>
        <div><Label className="mb-1.5">{t("auth.organization")}</Label>
          <Input value={profile.organization} onChange={(e) => setProfile({ ...profile, organization: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="mb-1.5">{t("auth.mobile")}</Label>
            <Input value={profile.mobile} onChange={(e) => setProfile({ ...profile, mobile: e.target.value })} /></div>
          <div><Label className="mb-1.5">Country</Label>
            <Input value={profile.country} onChange={(e) => setProfile({ ...profile, country: e.target.value })} /></div>
        </div>
        <Button onClick={save} disabled={loading} className="bg-gradient-primary text-primary-foreground shadow-glow">
          {loading ? t("common.loading") : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
