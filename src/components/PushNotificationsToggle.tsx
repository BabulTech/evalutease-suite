import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Lets the user opt-in to native push notifications. Only useful inside the
 * Capacitor Android/iOS shell — hidden on the web.
 *
 * State is stored in localStorage("push_enabled") and read by lib/push.ts
 * on the next session load.
 */
export function PushNotificationsToggle() {
  const [isNative, setIsNative] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // @ts-expect-error injected at runtime by Capacitor
    const native = !!window.Capacitor?.isNativePlatform?.();
    setIsNative(native);
    setEnabled(localStorage.getItem("push_enabled") === "1");
  }, []);

  if (!isNative) return null; // hide on web

  const enable = async () => {
    setBusy(true);
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      const req = await PushNotifications.requestPermissions();
      if (req.receive !== "granted") {
        toast.error("Notification permission was denied. Enable it in Settings → Apps → Jancho.");
        setBusy(false);
        return;
      }
      try {
        await PushNotifications.register();
      } catch (e) {
        toast.error("Could not register for push. Push notifications may not be configured for this build yet.");
        console.warn("[PushNotificationsToggle] register failed:", e);
        setBusy(false);
        return;
      }
      localStorage.setItem("push_enabled", "1");
      setEnabled(true);
      toast.success("Push notifications enabled. You'll receive alerts for new approvals, reviews, and quiz reminders.");
    } catch (e) {
      toast.error("Could not enable push: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const disable = () => {
    localStorage.removeItem("push_enabled");
    setEnabled(false);
    toast.success("Push notifications disabled on this device.");
  };

  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 flex items-center justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className={`rounded-xl p-2 ${enabled ? "bg-success/10 text-success" : "bg-muted/40 text-muted-foreground"}`}>
          {enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">Push notifications</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {enabled
              ? "Enabled on this device — payment approvals, reviews, and reminders will land in your status bar."
              : "Get OS-level alerts for payment approvals, new reviews, plan expiry, and quiz reminders."}
          </div>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant={enabled ? "outline" : "default"}
        onClick={enabled ? disable : enable}
        disabled={busy}
        className="shrink-0"
      >
        {busy ? "…" : enabled ? "Disable" : "Enable"}
      </Button>
    </div>
  );
}
