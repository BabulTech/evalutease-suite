/**
 * Premium animated splash screen for the Jancho native app.
 *
 * Boots automatically on Capacitor app launch:
 *   1. Native plugin shows the static splash for ~600ms (zero perceived delay)
 *   2. React mounts; this component takes over with full animations:
 *      - Logo scales in with glow + rotation
 *      - Letter-by-letter brand reveal
 *      - Tagline fade
 *      - Particle field in the background
 *   3. After ~2.2s the overlay fades out and the actual app appears.
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

  useEffect(() => {
    if (!visible) return;

    // Hide native Capacitor splash as soon as our animated one is mounted
    void import("@capacitor/splash-screen")
      .then(({ SplashScreen: NativeSplash }) => {
        void NativeSplash.hide({ fadeOutDuration: 200 });
      })
      .catch(() => { /* not in capacitor — fine */ });

    // Play animation, then exit
    const exitTimer = setTimeout(() => setExiting(true), 2000);
    const removeTimer = setTimeout(() => {
      sessionStorage.setItem(SHOWN_KEY, "1");
      setVisible(false);
    }, 2500);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ${
        exiting ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        background:
          "radial-gradient(ellipse at top, #134e4a 0%, #0b1220 50%, #000000 100%)",
      }}
      aria-hidden="true"
    >
      {/* Particle field — 30 floating dots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 30 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-primary/40"
            style={{
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `splashFloat ${4 + Math.random() * 4}s ease-in-out ${Math.random() * 2}s infinite`,
              opacity: 0.3 + Math.random() * 0.5,
            }}
          />
        ))}
      </div>

      {/* Glow halo behind logo */}
      <div
        className="absolute rounded-full"
        style={{
          width: 280,
          height: 280,
          background:
            "radial-gradient(circle, rgba(45, 212, 191, 0.35) 0%, rgba(45, 212, 191, 0) 70%)",
          animation: "splashPulse 2s ease-in-out infinite",
        }}
      />

      {/* Logo */}
      <div
        className="relative"
        style={{ animation: "splashLogoIn 0.9s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
      >
        <img
          src="/jancho_transparent_4k.png"
          alt="Jancho"
          width={132}
          height={132}
          className="size-32 object-contain drop-shadow-[0_0_30px_rgba(45,212,191,0.6)]"
        />
      </div>

      {/* Brand name — letter-by-letter reveal */}
      <div className="relative mt-6 flex" aria-label="Jancho">
        {"Jancho".split("").map((char, i) => (
          <span
            key={i}
            className="font-display text-5xl font-bold tracking-tight"
            style={{
              color: i < 3 ? "#ffffff" : "#2dd4bf",
              animation: `splashLetterIn 0.5s ease-out ${0.4 + i * 0.08}s both`,
            }}
          >
            {char}
          </span>
        ))}
      </div>

      {/* Tagline */}
      <p
        className="relative mt-3 text-xs sm:text-sm font-medium tracking-[0.18em] uppercase text-primary/80"
        style={{ animation: "splashFadeUp 0.6s ease-out 1.0s both" }}
      >
        AI-Powered Assessments
      </p>

      {/* Bottom: by BabulTech */}
      <p
        className="absolute bottom-10 text-[10px] tracking-[0.3em] uppercase text-muted-foreground/60"
        style={{ animation: "splashFadeUp 0.6s ease-out 1.3s both" }}
      >
        by BabulTech
      </p>

      {/* Loading bar */}
      <div className="absolute bottom-20 w-32 h-0.5 rounded-full bg-primary/15 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-transparent via-primary to-transparent"
          style={{ animation: "splashSweep 1.2s ease-in-out infinite" }}
        />
      </div>

      {/* Inline keyframes — scoped so they don't pollute the rest of the app */}
      <style>{`
        @keyframes splashLogoIn {
          0%   { opacity: 0; transform: scale(0.4) rotate(-20deg); }
          60%  { opacity: 1; transform: scale(1.08) rotate(4deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes splashLetterIn {
          0%   { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashFadeUp {
          0%   { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashPulse {
          0%, 100% { transform: scale(1);   opacity: 0.8; }
          50%      { transform: scale(1.15); opacity: 1; }
        }
        @keyframes splashFloat {
          0%, 100% { transform: translate(0, 0); }
          50%      { transform: translate(${"20px, -30px"}); }
        }
        @keyframes splashSweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
