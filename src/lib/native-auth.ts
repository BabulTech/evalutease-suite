/**
 * Google OAuth for the Capacitor native shell.
 *
 * The web flow: signInWithOAuth → browser → Google → Supabase → redirect to
 *               window.location.origin (web page picks up the tokens).
 *
 * The Capacitor flow: signInWithOAuth(skipBrowserRedirect) → we get back the
 *                     authorisation URL → open it in the in-app Browser (Chrome
 *                     Custom Tab) → after Google success, Supabase redirects to
 *                     a custom-scheme URL (jancho://auth/callback) which Android
 *                     opens directly back in this app → an appUrlOpen listener
 *                     reads the tokens from the URL and seeds the Supabase
 *                     session.
 *
 * Required setup:
 *   1. Supabase Dashboard > Auth > URL Configuration > Redirect URLs:
 *        jancho://auth/callback
 *   2. Google Cloud Console > Credentials > OAuth client (web) > Authorized
 *      redirect URIs already includes Supabase's callback URL (this is set up
 *      when you originally enabled Google in Supabase Auth).
 *   3. AndroidManifest.xml intent-filter for the `jancho` scheme (added via
 *      a build-time script — see android/app/src/main/AndroidManifest.xml).
 */
import { supabase } from "@/integrations/supabase/client";

export const NATIVE_AUTH_REDIRECT = "jancho://auth/callback";

export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  // @ts-expect-error injected at runtime by Capacitor
  return !!window.Capacitor?.isNativePlatform?.();
}

/**
 * Starts Google sign-in. On web, uses the standard redirect. On Capacitor,
 * opens the auth URL in an in-app Chrome Custom Tab and returns control to
 * the app via the deep-link callback handler.
 */
export async function signInWithGoogleNativeAware(): Promise<{ error: Error | null }> {
  if (!isNativePlatform()) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/dashboard" },
    });
    return { error: error as Error | null };
  }

  // Capacitor path: do NOT auto-redirect the WebView; we'll open the URL
  // in the in-app browser instead.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: NATIVE_AUTH_REDIRECT,
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) {
    return { error: (error as Error | null) ?? new Error("No OAuth URL returned") };
  }

  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: data.url, presentationStyle: "popover" });
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/**
 * Initialise the deep-link listener once. Call from the top-level app shell.
 * When the OS routes a `jancho://auth/callback#...` URL back to the app, we
 * parse the tokens, close the in-app browser, and tell Supabase to use the
 * new session.
 */
export async function initNativeAuthDeepLink(onAuthenticated: () => void) {
  if (!isNativePlatform()) return;
  try {
    const { App } = await import("@capacitor/app");
    const { Browser } = await import("@capacitor/browser");

    App.addListener("appUrlOpen", async (event) => {
      const url = event.url ?? "";
      if (!url.startsWith(NATIVE_AUTH_REDIRECT)) return;

      // Supabase returns tokens in the URL hash, e.g.
      //   jancho://auth/callback#access_token=...&refresh_token=...&expires_in=...
      const hash = url.split("#")[1] ?? "";
      const params = new URLSearchParams(hash);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      // Close the in-app browser regardless of success
      try { await Browser.close(); } catch { /* ignore */ }

      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (!error) onAuthenticated();
        else console.warn("[native-auth] setSession failed:", error.message);
      } else {
        console.warn("[native-auth] callback URL missing tokens");
      }
    });
  } catch (e) {
    console.warn("[native-auth] init failed:", e);
  }
}
