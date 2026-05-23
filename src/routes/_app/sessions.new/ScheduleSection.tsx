import { CalendarClock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";

export function ScheduleSection({
  scheduleEnabled,
  setScheduleEnabled,
  scheduledAtLocal,
  setScheduledAtLocal,
  errors,
  setErrors,
}: {
  scheduleEnabled: boolean;
  setScheduleEnabled: (v: boolean) => void;
  scheduledAtLocal: string;
  setScheduledAtLocal: (v: string) => void;
  errors: { schedule?: string };
  setErrors: (
    fn: (p: Record<string, string | undefined>) => Record<string, string | undefined>,
  ) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-primary" />
          <div>
            <Label htmlFor="schedule-switch" className="text-sm font-semibold">
              {t("newSess.scheduleLater")}
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">{t("newSess.scheduleLaterDesc")}</p>
          </div>
        </div>
        <Switch
          id="schedule-switch"
          checked={scheduleEnabled}
          onCheckedChange={(v) => {
            setScheduleEnabled(v);
            if (v && !scheduledAtLocal) {
              // react-doctor-disable-next-line react-doctor/rendering-hydration-mismatch-time
              const next = new Date(Date.now() + 30 * 60_000);
              next.setSeconds(0, 0);
              setScheduledAtLocal(next.toISOString().slice(0, 16));
            }
            if (!v) {
              setScheduledAtLocal("");
              setErrors((p) => ({ ...p, schedule: undefined }));
            }
          }}
        />
      </div>

      {scheduleEnabled && (
        <div className="pt-3 border-t border-border">
          <Label className="mb-1.5">{t("newSess.dateTime")}</Label>
          <Input
            type="datetime-local"
            value={scheduledAtLocal}
            onChange={(e) => {
              setScheduledAtLocal(e.target.value);
              setErrors((p) => ({ ...p, schedule: undefined }));
            }}
            // react-doctor-disable-next-line react-doctor/rendering-hydration-mismatch-time
            min={new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16)}
            className={errors.schedule ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {errors.schedule ? (
            <p className="mt-1 text-xs text-destructive">{errors.schedule}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{t("newSess.scheduleNote")}</p>
          )}
        </div>
      )}
    </div>
  );
}
