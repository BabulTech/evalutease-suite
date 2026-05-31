/**
 * Android in-app update check.
 *
 * Compares the running app's versionCode against public/update.json (served from
 * the deployed web app). Two outcomes:
 *   - updateAvailable: a newer build exists → offer a download in Settings.
 *   - blocked:         current build is older than minSupportedVersionCode →
 *                      ForceUpdateGate locks the app until the user updates.
 *
 * The APK itself lives in a public Supabase Storage bucket; we just open its
 * URL in the system browser so Android's package installer takes over. iOS is
 * intentionally excluded (App Store policy forbids side-loading).
 */
import { Capacitor } from "@capacitor/core";
import { VERSION_CODE, VERSION_NAME } from "./app-version";

/**
 * update.json is served from the Supabase "app-releases" bucket (same place as
 * the APKs), NOT from the web app. The deployed site sits behind Vercel's bot
 * "Security Checkpoint", which returns a 403 HTML challenge to plain fetches —
 * so fetching /update.json from the site fails. Supabase storage has no such
 * challenge, so the in-app check is reliable there.
 */
const UPDATE_MANIFEST_URL =
  "https://jfwnyktkzhnblpmtamke.supabase.co/storage/v1/object/public/app-releases/update.json";

export type UpdateManifest = {
  latestVersionCode: number;
  latestVersionName: string;
  minSupportedVersionCode: number;
  apkUrl: string;
  releaseNotes: string;
  mandatory: boolean;
  publishedAt: string;
};

export type UpdateStatus = {
  currentVersionCode: number;
  currentVersionName: string;
  manifest: UpdateManifest | null;
  updateAvailable: boolean;
  /** App must update before it can be used (current < minSupported, or mandatory). */
  blocked: boolean;
  checkedAt: number;
  error?: string;
};

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

/**
 * Resolve the running app's versionCode. On the native shell we read it from
 * @capacitor/app; on web we fall back to the bundled constant.
 */
async function getCurrentVersion(): Promise<{ code: number; name: string }> {
  if (!Capacitor.isNativePlatform()) {
    return { code: VERSION_CODE, name: VERSION_NAME };
  }
  try {
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    // Android returns build (versionCode) as a string.
    const code = Number.parseInt(String(info.build ?? ""), 10);
    return {
      code: Number.isFinite(code) ? code : VERSION_CODE,
      name: info.version || VERSION_NAME,
    };
  } catch {
    return { code: VERSION_CODE, name: VERSION_NAME };
  }
}

/**
 * Fetch update.json (cache-busted) and compute update status.
 * Never throws — on any failure returns a non-blocking status so a flaky
 * network can't lock users out.
 */
export async function checkForUpdate(): Promise<UpdateStatus> {
  const current = await getCurrentVersion();
  const base: UpdateStatus = {
    currentVersionCode: current.code,
    currentVersionName: current.name,
    manifest: null,
    updateAvailable: false,
    blocked: false,
    checkedAt: Date.now(),
  };

  // Only meaningful on the Android native shell.
  if (!isAndroidNative()) return base;

  try {
    const res = await fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return { ...base, error: `update.json ${res.status}` };
    const manifest = (await res.json()) as UpdateManifest;

    const hasApk = typeof manifest.apkUrl === "string" && manifest.apkUrl.length > 0;
    const updateAvailable = hasApk && manifest.latestVersionCode > current.code;
    const belowMin =
      typeof manifest.minSupportedVersionCode === "number" &&
      current.code < manifest.minSupportedVersionCode;
    const blocked = hasApk && (belowMin || (manifest.mandatory && updateAvailable));

    return { ...base, manifest, updateAvailable, blocked };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Open the APK URL in the system browser so Android's installer can take over.
 */
export async function downloadUpdate(apkUrl: string): Promise<void> {
  if (!apkUrl) return;
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url: apkUrl });
  } catch {
    // Fallback for web / if the Browser plugin is unavailable.
    window.open(apkUrl, "_blank");
  }
}
