import { useCallback, useEffect, useState } from "react";
import { DownloadCloud, RefreshCw } from "lucide-react";
import { checkForUpdate, downloadUpdate, type UpdateStatus } from "@/lib/app-update";

/**
 * Full-screen blocker shown on cold launch when the running Android build is
 * older than minSupportedVersionCode (or the release is marked mandatory).
 * Covers all app content with no dismiss path until the user updates.
 *
 * No-op on web/iOS and when the build is up to date.
 */
export function ForceUpdateGate() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [rechecking, setRechecking] = useState(false);

  useEffect(() => {
    void checkForUpdate().then(setStatus);
  }, []);

  const recheck = useCallback(async () => {
    setRechecking(true);
    const next = await checkForUpdate();
    setStatus(next);
    setRechecking(false);
  }, []);

  if (!status?.blocked || !status.manifest) return null;
  const m = status.manifest;

  return (
    <div
      className="fixed inset-0 z-[10001] flex flex-col items-center justify-center gap-6 px-6 text-center"
      style={{
        background:
          "radial-gradient(ellipse at top, #134e4a 0%, #0b1220 55%, #000 100%)",
      }}
    >
      <img
        src="/jancho_logo_512.svg"
        alt="Jancho"
        className="size-20 object-contain drop-shadow-[0_0_24px_rgba(45,212,191,0.5)]"
      />

      <div className="max-w-sm space-y-2">
        <h1 className="text-xl font-semibold text-white">Update required</h1>
        <p className="text-sm text-white/60">
          A newer version of Jancho is required to continue. Please update to
          version {m.latestVersionName} to keep using the app.
        </p>
        {m.releaseNotes && (
          <p className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left text-xs text-white/70">
            {m.releaseNotes}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => void downloadUpdate(m.apkUrl)}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition active:scale-95"
      >
        <DownloadCloud className="size-5" /> Download update
      </button>

      <button
        type="button"
        onClick={() => void recheck()}
        disabled={rechecking}
        className="inline-flex items-center gap-2 text-xs text-white/50 hover:text-white/80 disabled:opacity-60"
      >
        <RefreshCw className={`size-4 ${rechecking ? "animate-spin" : ""}`} /> I&apos;ve
        already updated — re-check
      </button>

      <p className="absolute bottom-8 text-[10px] tracking-[0.2em] uppercase text-white/30">
        Current: v{status.currentVersionName} · build {status.currentVersionCode}
      </p>
    </div>
  );
}
