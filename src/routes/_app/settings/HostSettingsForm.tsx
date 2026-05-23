import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { usePlan } from "@/contexts/PlanContext";
import {
  defaultHostSettings,
  normalizeRegistrationFields,
  normalizeRegistrationFieldsByType,
  REGISTRATION_FIELD_KEYS,
  REGISTRATION_FIELD_LABELS,
  PARTICIPANT_TYPE_KEYS,
  PARTICIPANT_TYPE_LABELS,
  DEFAULT_FIELDS_BY_TYPE,
  type HostSettings,
  type RegistrationFieldKey,
  type RegistrationFields,
  type FieldTypeKey,
} from "@/components/settings/host-settings";

function RegistrationFieldsEditor({
  value,
  byType,
  onChange,
  onChangeByType,
}: {
  value: HostSettings["registration_fields"];
  byType: HostSettings["registration_fields_by_type"];
  onChange: (next: HostSettings["registration_fields"]) => void;
  onChangeByType: (next: HostSettings["registration_fields_by_type"]) => void;
}) {
  const { t } = useI18n();
  const [activeType, setActiveType] = useState<FieldTypeKey>("default");

  const isDefault = activeType === "default";
  const hasOverride = !isDefault && Boolean(byType[activeType]);
  const effective: RegistrationFields = isDefault ? value : (byType[activeType] ?? value);

  const update = (
    key: RegistrationFieldKey,
    patch: Partial<{ visible: boolean; required: boolean }>,
  ) => {
    const next = { ...effective, [key]: { ...effective[key], ...patch } };
    if (key === "name") {
      next.name = { visible: true, required: true };
    } else if (!next[key].visible) {
      next[key].required = false;
    }
    if (isDefault) onChange(next);
    else onChangeByType({ ...byType, [activeType]: next });
  };

  const enableOverride = () => {
    if (isDefault) return;
    const seed = DEFAULT_FIELDS_BY_TYPE[activeType] ?? value;
    onChangeByType({ ...byType, [activeType]: structuredClone(seed) });
  };

  const removeOverride = () => {
    if (isDefault) return;
    const next = { ...byType };
    delete next[activeType];
    onChangeByType(next);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">{t("settings.registrationTitle")}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t("settings.registrationDesc")}</p>
      </div>

      <div>
        <Label className="mb-2 text-xs text-muted-foreground font-medium">
          Configure for participant type
        </Label>
        <div className="flex flex-wrap gap-2">
          {PARTICIPANT_TYPE_KEYS.map((key) => {
            const hasCustom = key !== "default" && Boolean(byType[key]);
            const active = activeType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveType(key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                  active
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {PARTICIPANT_TYPE_LABELS[key]}
                {hasCustom && (
                  <span
                    className="ml-1 inline-block size-1.5 rounded-full bg-primary"
                    aria-label="customized"
                  />
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {isDefault
            ? "These fields show when participant type is not set or unknown."
            : hasOverride
              ? "This type has a custom field config. Switch the toggles below to edit."
              : 'This type uses the default config above. Click "Customize for this type" to override.'}
        </p>
      </div>

      {!isDefault && (
        <div className="flex flex-wrap gap-2">
          {!hasOverride ? (
            <Button type="button" variant="outline" size="sm" onClick={enableOverride}>
              Customize for this type
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={removeOverride}
              className="text-destructive hover:text-destructive"
            >
              Reset to default
            </Button>
          )}
        </div>
      )}

      <div
        className={`rounded-xl border border-border overflow-hidden ${!isDefault && !hasOverride ? "opacity-60 pointer-events-none" : ""}`}
      >
        <div className="grid grid-cols-[1fr_auto_auto] items-center px-3 sm:px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
          <span>{t("settings.colField")}</span>
          <span className="px-3">{t("settings.colVisible")}</span>
          <span className="px-3">{t("settings.colRequired")}</span>
        </div>
        <ul className="divide-y divide-border/60">
          {REGISTRATION_FIELD_KEYS.map((key) => {
            const cfg = effective[key];
            const isName = key === "name";
            return (
              <li
                key={key}
                className="grid grid-cols-[1fr_auto_auto] items-center p-3 sm:px-4 hover:bg-muted/20"
              >
                <span className="text-sm font-medium">
                  {REGISTRATION_FIELD_LABELS[key]}
                  {isName && (
                    <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                      {t("settings.alwaysOn")}
                    </span>
                  )}
                </span>
                <div className="px-2 sm:px-3">
                  <Switch
                    checked={cfg.visible}
                    disabled={isName}
                    onCheckedChange={(v) => update(key, { visible: v })}
                  />
                </div>
                <div className="px-2 sm:px-3">
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
      <p className="text-xs text-muted-foreground">{t("settings.registrationNote")}</p>
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
  const { plan } = usePlan();
  const { t } = useI18n();
  const canCustom = plan?.custom_branding ?? false;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold">{t("settings.scoringTitle")}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t("settings.scoringDesc")}</p>
      </div>

      <div className="relative">
        <Label className="mb-1.5 flex items-center gap-2">
          {t("settings.marksPerQ")}
          {!canCustom && (
            <span className="text-[10px] bg-warning/20 text-warning border border-warning/30 rounded-full px-2 py-0.5 font-semibold">
              Pro+
            </span>
          )}
        </Label>
        {canCustom ? (
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
        ) : (
          <div className="flex items-center gap-3">
            <Input value={1} disabled className="w-32 opacity-50" />
            <Link
              to="/settings"
              search={{ tab: "plan" }}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Lock className="size-3" /> Upgrade to customise
            </Link>
          </div>
        )}
        {!canCustom && (
          <p className="text-xs text-muted-foreground mt-1">{t("settings.marksFreeLocked")}</p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              {t("settings.speedBonus")}
              {!canCustom && (
                <span className="text-[10px] bg-warning/20 text-warning border border-warning/30 rounded-full px-2 py-0.5 font-semibold">
                  Pro+
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {canCustom ? t("settings.speedBonusDesc") : t("settings.speedBonusFreeNote")}
            </p>
          </div>
          {canCustom ? (
            <Switch
              checked={value.speed_bonus_enabled}
              onCheckedChange={(v) => onChange({ speed_bonus_enabled: v })}
            />
          ) : (
            <Link
              to="/settings"
              search={{ tab: "plan" }}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Lock className="size-3" /> Upgrade
            </Link>
          )}
        </div>
        {canCustom && value.speed_bonus_enabled && (
          <div>
            <Label className="mb-1.5">{t("settings.maxBonusPerSession")}</Label>
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
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/40 p-4">
        <div>
          <div className="text-sm font-semibold">{t("settings.showExplanation")}</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("settings.showExplanationDesc")}
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

export function HostSettingsForm({
  userId,
  section,
}: {
  userId: string;
  section: "registration" | "scoring";
}) {
  const { t } = useI18n();
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
        registration_fields_by_type: normalizeRegistrationFieldsByType(
          (data as Record<string, unknown>).registration_fields_by_type,
        ),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- host_settings table not yet in generated Supabase types
    const { error } = await (supabase as any).from("host_settings").upsert(
      {
        owner_id: userId,
        registration_fields: settings.registration_fields,
        registration_fields_by_type: settings.registration_fields_by_type,
        marks_per_correct: settings.marks_per_correct,
        speed_bonus_enabled: settings.speed_bonus_enabled,
        speed_bonus_max: settings.speed_bonus_max,
        show_explanation: settings.show_explanation,
      },
      { onConflict: "owner_id" },
    );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("settings.saveChanges"));
  };

  if (loading) {
    return (
      <div className="rounded-xl md:rounded-2xl border border-border bg-card/40 p-5 md:p-6 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="rounded-xl md:rounded-2xl border border-border bg-card/60 p-4 md:p-6 space-y-5">
      {section === "registration" ? (
        <RegistrationFieldsEditor
          value={settings.registration_fields}
          byType={settings.registration_fields_by_type}
          onChange={(rf) => setSettings((prev) => ({ ...prev, registration_fields: rf }))}
          onChangeByType={(bt) =>
            setSettings((prev) => ({ ...prev, registration_fields_by_type: bt }))
          }
        />
      ) : (
        <ScoringEditor
          value={settings}
          onChange={(s) => setSettings((prev) => ({ ...prev, ...s }))}
        />
      )}

      <Button
        onClick={save}
        disabled={saving}
        className="h-11 w-full sm:w-auto bg-gradient-primary text-primary-foreground shadow-glow"
      >
        {saving ? t("settings.saving") : t("settings.saveChanges")}
      </Button>
    </div>
  );
}
