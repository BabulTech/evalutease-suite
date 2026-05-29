import { useCallback, useEffect, useState } from "react";
import { Fingerprint, LogOut } from "lucide-react";
import { isNativePlatform, isBiometricEnabled, unlockWithBiometric } from "@/lib/biometric";
import { supabase } from "@/integrations/supabase/client";

/**
 * Full-screen biometric gate shown on cold launch when the user has enabled
 * biometric lock. Covers all app content until fingerprint / face passes.
 * No-op on web and when biometric lock is off.
 */
export function BiometricLock() {
  const [locked, setLocked] = useState(
    () => isNativePlatform() && isBiometricEnabled(),
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const attempt = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    const res = await unlockWithBiometric();
    setBusy(false);
    if (res === "success") setLocked(false);
    else setFailed(true);
  }, []);

  useEffect(() => {
    if (locked) void attempt();
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!locked) return null;

  const usePassword = async () => {
    // Bail out to the login screen with a fresh session.
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-6 px-6"
      style={{
        background:
          "radial-gradient(ellipse at top, #134e4a 0%, #0b1220 55%, #000 100%)",
      }}
    >
      <img
        src="/jancho_transparent_4k.png"
        alt="Jancho"
        className="size-20 object-contain drop-shadow-[0_0_24px_rgba(45,212,191,0.5)]"
      />

      <button
        type="button"
        onClick={attempt}
        disabled={busy}
        aria-label="Unlock with biometrics"
        className="flex size-24 items-center justify-center rounded-full bg-primary/15 ring-2 ring-primary/40 transition active:scale-95 disabled:opacity-60"
      >
        <Fingerprint className={`size-12 text-primary ${busy ? "animate-pulse" : ""}`} />
      </button>

      <div className="text-center">
        <p className="text-base font-semibold text-white">
          {busy ? "Verifying…" : failed ? "Authentication failed" : "Unlock Jancho"}
        </p>
        <p className="mt-1 text-sm text-white/50">
          {failed ? "Tap the icon to try again" : "Use your fingerprint or face to continue"}
        </p>
      </div>

      <button
        type="button"
        onClick={usePassword}
        className="mt-2 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80"
      >
        <LogOut className="size-4" /> Use password instead
      </button>
    </div>
  );
}
