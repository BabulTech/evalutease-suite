/**
 * Biometric app-lock for the Capacitor native shell (fingerprint / face).
 *
 * UX (banking-style):
 *   - After login, the user can enable biometric lock from Settings (or the
 *     one-time prompt). We verify their biometric once and store the current
 *     Supabase refresh token in the device's encrypted store (Keystore /
 *     Keychain) as a fallback.
 *   - On every cold launch, BiometricLock covers the app until the user passes
 *     fingerprint / face. Because Supabase already persists the session, a pass
 *     simply reveals the app. If the persisted session is gone (expired), we
 *     restore it from the stored refresh token.
 *
 * Web / PWA: every function is a safe no-op.
 */
import { supabase } from "@/integrations/supabase/client";

const ENABLED_KEY = "biometric_enabled_v1";
const RT_KEY = "biometric_refresh_token";

export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  // @ts-expect-error injected by Capacitor at runtime
  return !!window.Capacitor?.isNativePlatform?.();
}

export function isBiometricEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ENABLED_KEY) === "1";
}

/** True only on a native device that actually has biometry enrolled. */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    const res = await BiometricAuth.checkBiometry();
    return res.isAvailable;
  } catch {
    return false;
  }
}

/** Shows the OS fingerprint / face prompt. Resolves true on success. */
async function verifyIdentity(reason: string): Promise<boolean> {
  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: "Cancel",
      androidTitle: "Jancho",
      androidSubtitle: reason,
      // Let the user fall back to the device PIN / pattern if biometry fails.
      allowDeviceCredential: true,
    });
    return true;
  } catch {
    return false;
  }
}

async function storeRefreshToken(token: string): Promise<void> {
  try {
    const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
    await SecureStorage.set(RT_KEY, token);
  } catch {
    /* secure storage unavailable — the live persisted session still works */
  }
}

/**
 * Keep the encrypted fallback token in sync as Supabase rotates it in the
 * background. Call from the auth state listener on SIGNED_IN / TOKEN_REFRESHED.
 */
export async function syncStoredToken(): Promise<void> {
  if (!isNativePlatform() || !isBiometricEnabled()) return;
  const { data } = await supabase.auth.getSession();
  const rt = data.session?.refresh_token;
  if (rt) await storeRefreshToken(rt);
}

/** Turn on biometric lock: verify once, then remember the current session. */
export async function enableBiometricLogin(): Promise<{ ok: boolean; reason?: string }> {
  if (!isNativePlatform()) return { ok: false, reason: "Only available in the mobile app." };
  if (!(await isBiometricAvailable())) {
    return { ok: false, reason: "No fingerprint or face is set up on this device." };
  }
  const { data } = await supabase.auth.getSession();
  const rt = data.session?.refresh_token;
  if (!rt) return { ok: false, reason: "Please sign in first." };

  if (!(await verifyIdentity("Enable biometric login"))) {
    return { ok: false, reason: "Biometric verification was cancelled." };
  }
  await storeRefreshToken(rt);
  localStorage.setItem(ENABLED_KEY, "1");
  return { ok: true };
}

export async function disableBiometricLogin(): Promise<void> {
  localStorage.removeItem(ENABLED_KEY);
  try {
    const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
    await SecureStorage.remove(RT_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Run at the lock screen. Prompts biometry; on success reveals the app,
 * restoring the session from the stored token if the live one is gone.
 * Returns "success" or "failed".
 */
export async function unlockWithBiometric(): Promise<"success" | "failed"> {
  if (!(await verifyIdentity("Unlock Jancho"))) return "failed";

  // Already have a live session? Just let them in.
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    await syncStoredToken();
    return "success";
  }

  // Otherwise restore it from the encrypted fallback token.
  try {
    const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
    const rt = (await SecureStorage.get(RT_KEY)) as string | null;
    if (!rt) return "failed";
    const { error } = await supabase.auth.refreshSession({ refresh_token: rt });
    if (error) return "failed";
    await syncStoredToken();
    return "success";
  } catch {
    return "failed";
  }
}
