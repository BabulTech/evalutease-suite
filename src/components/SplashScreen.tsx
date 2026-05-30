/**
 * Splash screen for the Jancho native app.
 *
 * Boots automatically on Capacitor app launch:
 *   1. Native plugin shows the static splash for ~600ms (zero perceived delay)
 *   2. React mounts and takes over with the self-contained animated SVG
 *      (public/jancho_splash_clean_animated.svg) — it draws the logo on,
 *      reveals the "Jancho" wordmark and tagline, then idles with a soft glow.
 *   3. After the reveal completes the overlay fades out and the app appears.
 *
 * The SVG owns ALL splash artwork (background, logo, wordmark, tagline), so
 * this component is just the full-screen host + timing. Do not re-draw the
 * logo or brand name here or it will appear twice.
 *
 * Web users (browser/PWA) see this too on first load — no-op on
 * subsequent navigations (sessionStorage flag).
 */
import { useEffect, useState } from "react";

const SHOWN_KEY = "splash_shown_v1";

function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  // @ts-expect-error injected by Capacitor at runtime
  return !!window.Capacitor?.isNativePlatform?.();
}

export function SplashScreen() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    // Only show inside the Capacitor native shell. Web/PWA gets nothing.
    if (!isNativePlatform()) return false;
    return sessionStorage.getItem(SHOWN_KEY) !== "1";
  });
  const [exiting, setExiting] = useState(false);

  // ALWAYS release the native Capacitor splash on first mount — even when we
  // don't show the React overlay. With launchAutoHide:false the native splash
  // stays up until hide() is called, so gating this behind `visible` could
  // leave it stuck forever (e.g. when splash_shown is already set).
  useEffect(() => {
    if (!isNativePlatform()) return;
    void import("@capacitor/splash-screen")
      .then(({ SplashScreen: NativeSplash }) => {
        void NativeSplash.hide({ fadeOutDuration: 200 });
      })
      .catch(() => { /* not in capacitor — fine */ });
  }, []);

  useEffect(() => {
    if (!visible) return;

    // Keep it snappy: the SVG logo is drawn by ~1.25s; fade out shortly after.
    const exitTimer = setTimeout(() => setExiting(true), 2200);
    const removeTimer = setTimeout(() => {
      sessionStorage.setItem(SHOWN_KEY, "1");
      setVisible(false);
    }, 2600);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden transition-opacity duration-500 ${
        exiting ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ background: "#070B1A" }}
      aria-hidden="true"
    >
      <img
        src="/jancho_splash_clean_animated.svg"
        alt="Jancho"
        className="object-contain"
        style={{ width: "min(100vw, 100vh)", height: "min(100vw, 100vh)" }}
      />
    </div>
  );
}
