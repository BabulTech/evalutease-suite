/**
 * Native push registration for the Capacitor app.
 *
 * On web (browser / PWA), this module is a no-op. On Android/iOS inside the
 * Capacitor shell, it:
 *   1. requests notification permission
 *   2. registers the device with FCM/APNs and obtains a token
 *   3. stores the token server-side via the register_push_token RPC
 *   4. listens for incoming pushes and routes tapped notifications to their `link`
 */
import { supabase } from "@/integrations/supabase/client";

type PushPlatform = "android" | "ios";

// Stored so we can unregister on sign-out without re-asking the device.
let lastToken: string | null = null;

export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  // @ts-expect-error injected by Capacitor at runtime
  return !!window.Capacitor?.isNativePlatform?.();
}

function getPlatform(): PushPlatform | null {
  if (typeof window === "undefined") return null;
  // @ts-expect-error injected by Capacitor at runtime
  const p = window.Capacitor?.getPlatform?.();
  if (p === "android" || p === "ios") return p;
  return null;
}

export async function initPushNotifications(navigateToLink?: (link: string) => void) {
  if (!isNativePlatform()) return; // web — handled by service worker / not at all

  const platform = getPlatform();
  if (!platform) return;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    // 1. Permission
    const perm = await PushNotifications.checkPermissions();
    let granted = perm.receive;
    if (granted === "prompt" || granted === "prompt-with-rationale") {
      const req = await PushNotifications.requestPermissions();
      granted = req.receive;
    }
    if (granted !== "granted") {
      console.warn("[push] permission not granted:", granted);
      return;
    }

    // 2. Register with FCM/APNs
    await PushNotifications.register();

    // 3. Store the token server-side
    PushNotifications.addListener("registration", async (tk) => {
      lastToken = tk.value;
      const deviceName =
        typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 120) : null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("register_push_token", {
        p_token: tk.value,
        p_platform: platform,
        p_device_name: deviceName,
      });
      if (error) console.warn("[push] register_push_token failed:", error.message);
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.warn("[push] registration error:", err);
    });

    // 4. Tapped a push while app was backgrounded/closed → deep-link to link
    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const link = (action.notification?.data as { link?: string } | undefined)?.link;
      if (link && navigateToLink) navigateToLink(link);
    });

    // (Optional) Foreground push handler — could show an in-app toast, but
    // the realtime notification bell already does that, so we leave it.
  } catch (err) {
    console.warn("[push] init failed:", err);
  }
}

export async function unregisterPushToken() {
  if (!isNativePlatform() || !lastToken) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc("unregister_push_token", { p_token: lastToken });
  } catch (err) {
    console.warn("[push] unregister failed:", err);
  }
  lastToken = null;
}
