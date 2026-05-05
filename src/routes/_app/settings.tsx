import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Settings as SettingsIcon, Trophy, ListChecks, User, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  defaultHostSettings,
  normalizeRegistrationFields,
  REGISTRATION_FIELD_KEYS,
  REGISTRATION_FIELD_LABELS,
  type HostSettings,
  type RegistrationFieldKey,
} from "@/components/settings/host-settings";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user } = useAuth();
  const { t } = useI18n();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-7 w-7 text-primary" /> {t("nav.settings")}
        </h1>
        <p className="text-muted-foreground mt-1">
          Profile, the registration form participants see when they join, and your scoring rules.
        </p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="h-4 w-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="registration" className="gap-1.5">
            <ListChecks className="h-4 w-4" /> Registration form
          </TabsTrigger>
          <TabsTrigger value="scoring" className="gap-1.5">
            <Trophy className="h-4 w-4" /> Scoring
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          {user && <ProfileForm userId={user.id} />}
        </TabsContent>
        <TabsContent value="registration" className="mt-4">
          {user && <HostSettingsForm userId={user.id} section="registration" />}
        </TabsContent>
        <TabsContent value="scoring" className="mt-4">
          {user && <HostSettingsForm userId={user.id} section="scoring" />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileForm({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    organization: "",
    mobile: "",
    country: "",
    avatar_url: "",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data)
          setProfile({
            first_name: data.first_name ?? "",
            last_name: data.last_name ?? "",
            organization: data.organization ?? "",
            mobile: data.mobile ?? "",
            country: data.country ?? "",
            avatar_url: data.avatar_url ?? "",
          });
      });
  }, [userId]);

  const name = `${profile.first_name} ${profile.last_name}`.trim() || "User";
  const initials = name.slice(0, 2).toUpperCase();

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Profile picture must be under 3 MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) {
      setUploading(false);
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatar_url = data.publicUrl;
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url })
      .eq("id", userId);
    setUploading(false);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    setProfile((prev) => ({ ...prev, avatar_url }));
    toast.success("Profile picture updated");
  };

  const save = async () => {
    setSaving(true);
    const full_name = `${profile.first_name} ${profile.last_name}`.trim();
    const { error } = await supabase
      .from("profiles")
      .update({ ...profile, full_name })
      .eq("id", userId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile saved");
  };

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="h-20 w-20 border border-primary/30">
          {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
          <AvatarFallback className="bg-primary/15 text-primary text-xl font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div>
          <Label htmlFor="avatar-upload" className="mb-1.5 block">
            Profile picture
          </Label>
          <Input
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="max-w-xs"
            disabled={uploading}
            onChange={(e) => void uploadAvatar(e.target.files?.[0])}
          />
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading..." : "JPG, PNG, or WebP up to 3 MB"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5">{t("auth.firstName")}</Label>
          <Input
            value={profile.first_name}
            onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
          />
        </div>
        <div>
          <Label className="mb-1.5">{t("auth.lastName")}</Label>
          <Input
            value={profile.last_name}
            onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label className="mb-1.5">{t("auth.organization")}</Label>
        <Input
          value={profile.organization}
          onChange={(e) => setProfile({ ...profile, organization: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5">{t("auth.mobile")}</Label>
          <Input
            value={profile.mobile}
            onChange={(e) => setProfile({ ...profile, mobile: e.target.value })}
          />
        </div>
        <div>
          <Label className="mb-1.5">Country</Label>
          <Input
            value={profile.country}
            onChange={(e) => setProfile({ ...profile, country: e.target.value })}
          />
        </div>
      </div>
      <Button
        onClick={save}
        disabled={saving}
        className="bg-gradient-primary text-primary-foreground shadow-glow"
      >
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}

function HostSettingsForm({
  userId,
  section,
}: {
  userId: string;
  section: "registration" | "scoring";
}) {
  const [settings, setSettings] = useState<HostSettings>(() => defaultHostSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("host_settings")
      .select("*")
      .eq("owner_id", userId)
      .maybeSingle();
    if (data) {
      setSettings({
        registration_fields: normalizeRegistrationFields(data.registration_fields),
        marks_per_correct: data.marks_per_correct ?? 1,
        speed_bonus_enabled: data.speed_bonus_enabled ?? false,
        speed_bonus_max: data.speed_bonus_max ?? 1,
        show_explanation: data.show_explanation ?? true,
      });
    } else {
      setSettings(defaultHostSettings());
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    const payload = {
      owner_id: userId,
      registration_fields: settings.registration_fields,
      marks_per_correct: settings.marks_per_correct,
      speed_bonus_enabled: settings.speed_bonus_enabled,
      speed_bonus_max: settings.speed_bonus_max,
      show_explanation: settings.show_explanation,
    };
    const { error } = await supabase
      .from("host_settings")
      .upsert(payload, { onConflict: "owner_id" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(section === "registration" ? "Registration form saved" : "Scoring saved");
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card/40 p-6 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 space-y-5">
      {section === "registration" ? (
        <RegistrationFieldsEditor
          value={settings.registration_fields}
          onChange={(rf) => setSettings({ ...settings, registration_fields: rf })}
        />
      ) : (
        <ScoringEditor value={settings} onChange={(s) => setSettings({ ...settings, ...s })} />
      )}

      <Button
        onClick={save}
        disabled={saving}
        className="bg-gradient-primary text-primary-foreground shadow-glow"
      >
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}

function RegistrationFieldsEditor({
  value,
  onChange,
}: {
  value: HostSettings["registration_fields"];
  onChange: (next: HostSettings["registration_fields"]) => void;
}) {
  const update = (
    key: RegistrationFieldKey,
    patch: Partial<{ visible: boolean; required: boolean }>,
  ) => {
    const next = { ...value, [key]: { ...value[key], ...patch } };
    if (key === "name") {
      next.name = { visible: true, required: true };
    } else if (!next[key].visible) {
      next[key].required = false;
    }
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold">What participants see when they join</h3>
        <p className="text-xs text-muted-foreground mt-1">
          These fields show up on the registration screen at{" "}
          <span className="font-mono">/q/&lt;PIN&gt;</span> before participants enter the lobby.
          Name is always shown and required.
        </p>
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] items-center px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
          <span>Field</span>
          <span className="px-3">Visible</span>
          <span className="px-3">Required</span>
        </div>
        <ul className="divide-y divide-border/60">
          {REGISTRATION_FIELD_KEYS.map((key) => {
            const cfg = value[key];
            const isName = key === "name";
            return (
              <li
                key={key}
                className="grid grid-cols-[1fr_auto_auto] items-center px-4 py-2.5 hover:bg-muted/20"
              >
                <span className="text-sm font-medium">
                  {REGISTRATION_FIELD_LABELS[key]}
                  {isName && (
                    <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                      always on
                    </span>
                  )}
                </span>
                <div className="px-3">
                  <Switch
                    checked={cfg.visible}
                    disabled={isName}
                    onCheckedChange={(v) => update(key, { visible: v })}
                  />
                </div>
                <div className="px-3">
                  <Switch
                    checked={cfg.required}
                    disabled={isName || !cfg.visible}
                    onCheckedChange={(v) => update(key, { required: v })}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">
        For closed-roster sessions, whichever fields you require also act as identity checks — a
        participant whose entered values don't match any invited person on your roster won't be able
        to join.
      </p>
    </div>
  );
}

function ScoringEditor({
  value,
  onChange,
}: {
  value: HostSettings;
  onChange: (
    next: Partial<
      Pick<
        HostSettings,
        "marks_per_correct" | "speed_bonus_enabled" | "speed_bonus_max" | "show_explanation"
      >
    >,
  ) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold">How answers turn into a score</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Applied to every quiz session you create. Speed bonus is optional and rewards quicker
          correct answers with extra points.
        </p>
      </div>

      <div>
        <Label className="mb-1.5">Marks per correct answer</Label>
        <Input
          type="number"
          min={1}
          max={100}
          value={value.marks_per_correct}
          onChange={(e) =>
            onChange({
              marks_per_correct: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
            })
          }
          className="w-32"
        />
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Speed bonus</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Extra points for correct answers given quickly. Disabled = everyone with the same
              correct count gets the same score.
            </p>
          </div>
          <Switch
            checked={value.speed_bonus_enabled}
            onCheckedChange={(v) => onChange({ speed_bonus_enabled: v })}
          />
        </div>
        {value.speed_bonus_enabled && (
          <div>
            <Label className="mb-1.5">Max bonus per session</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={value.speed_bonus_max}
              onChange={(e) =>
                onChange({
                  speed_bonus_max: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                })
              }
              className="w-32"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              The fastest answerer gets close to this; slower answerers get proportionally less,
              floored at zero. Bonus is added once when the participant finishes.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/40 p-4">
        <div>
          <div className="text-sm font-semibold">Show explanation after each question</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            If on, participants see your stored explanation right after the timer expires.
          </p>
        </div>
        <Switch
          checked={value.show_explanation}
          onCheckedChange={(v) => onChange({ show_explanation: v })}
        />
      </div>
    </div>
  );
}
