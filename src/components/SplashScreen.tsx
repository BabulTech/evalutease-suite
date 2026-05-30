/**
 * Native splash controller for the Jancho app.
 *
 * The animated React splash overlay was removed because it added a fixed ~2.2s
 * delay on TOP of the network load time, making cold launch feel slow. Now we
 * only hide the native Capacitor splash as soon as React mounts, so the app
 * appears the instant the web view is ready — no artificial wait.
 *
 * (The native plugin still shows its static splash during the initial load
 * because launchAutoHide is false; this component releases it on mount.)
 */
import { useEffect } from "react";

function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  // @ts-expect-error injected by Capacitor at runtime
  return !!window.Capacitor?.isNativePlatform?.();
}

export function SplashScreen() {
  // Release the native splash as soon as the app has mounted. With
  // launchAutoHide:false it stays up until hide() is called.
  useEffect(() => {
    if (!isNativePlatform()) return;
    void import("@capacitor/splash-screen")
      .then(({ SplashScreen: NativeSplash }) => {
        void NativeSplash.hide({ fadeOutDuration: 150 });
      })
      .catch(() => { /* not in capacitor — fine */ });
  }, []);

  return null;
}
