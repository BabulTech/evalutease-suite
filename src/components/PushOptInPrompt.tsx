import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

const DECISION_KEY = "push_opt_decision_v1";

function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  // @ts-expect-error injected by Capacitor at runtime
  return !!window.Capacitor?.isNativePlatform?.();
}

export function PushOptInPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isNativePlatform()) return;
    if (localStorage.getItem("push_enabled") === "1") return;
    if (localStorage.getItem(DECISION_KEY) === "dismissed") return;
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  const handleEnable = async () => {
    localStorage.setItem("push_enabled", "1");
    localStorage.setItem(DECISION_KEY, "enabled");
    setVisible(false);
    const { initPushNotifications } = await import("@/lib/push");
    void initPushNotifications((link) => { window.location.href = link; });
  };

  const handleDismiss = () => {
    localStorage.setItem(DECISION_KEY, "dismissed");
    setVisible(false);
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6 relative">
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Close"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
        >
          <X className="size-5" />
        </button>

        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/15">
          <Bell className="size-7 text-primary" />
        </div>

        <h2 className="text-center text-lg font-semibold text-foreground">
          Stay in the loop
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Enable notifications to get instant alerts for quiz results, participant
          activity, and important updates.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleEnable}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Allow notifications
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
