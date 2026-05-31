import { useCallback, useEffect, useState } from "react";
import { DownloadCloud, RefreshCw, BadgeCheck, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";
import {
  checkForUpdate,
  downloadUpdate,
  isAndroidNative,
  type UpdateStatus,
} from "@/lib/app-update";

const BABULTECH_URL = "https://babultech.com";

/**
 * Settings → About & Updates. Shows the current version, a manual update check,
 * a download button when a newer build exists, and the BabulTech ownership note.
 */
export function AboutUpdates() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const run = useCallback(async (manual: boolean) => {
    setChecking(true);
    const next = await checkForUpdate();
    setStatus(next);
    setChecking(false);
    if (manual) {
      if (next.error) toast.error("Couldn't check for updates. Try again.");
      else if (next.updateAvailable) toast.success("A new version is available!");
      else toast.success("You're on the latest version.");
    }
  }, []);

  useEffect(() => {
    void run(false);
  }, [run]);

  const openBabulTech = useCallback(async () => {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: BABULTECH_URL });
    } catch {
      window.open(BABULTECH_URL, "_blank");
    }
  }, []);

  const m = status?.manifest;
  const updateAvailable = status?.updateAvailable ?? false;

  return (
    <div className="space-y-4">
      {/* Version + update check */}
      <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Info className="size-5 text-primary" />
          <h3 className="font-semibold">App version</h3>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm">
            <p className="font-medium">
              v{status?.currentVersionName ?? "—"}
              <span className="text-muted-foreground">
                {" "}
                · build {status?.currentVersionCode ?? "—"}
              </span>
            </p>
            {m && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Latest available: v{m.latestVersionName} (build {m.latestVersionCode})
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void run(true)}
            disabled={checking}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium transition hover:bg-accent disabled:opacity-60"
          >
            <RefreshCw className={`size-4 ${checking ? "animate-spin" : ""}`} />
            Check for updates
          </button>
        </div>

        {!isAndroidNative() && (
          <p className="rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
            In-app updates are available in the Android app.
          </p>
        )}

        {updateAvailable && m && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
            <p className="text-sm font-medium text-primary">
              Update available — v{m.latestVersionName}
            </p>
            {m.releaseNotes && (
              <p className="text-xs text-muted-foreground">{m.releaseNotes}</p>
            )}
            <button
              type="button"
              onClick={() => void downloadUpdate(m.apkUrl)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition active:scale-95"
            >
              <DownloadCloud className="size-4" /> Download &amp; install
            </button>
            <p className="text-[11px] text-muted-foreground">
              You may need to allow “Install unknown apps” for your browser the
              first time.
            </p>
          </div>
        )}

        {!updateAvailable && isAndroidNative() && status && !status.error && (
          <p className="inline-flex items-center gap-1.5 text-xs text-emerald-500">
            <BadgeCheck className="size-4" /> You&apos;re on the latest version.
          </p>
        )}
      </div>

      {/* Ownership / dev notice */}
      <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-2">
        <p className="text-xs text-amber-500/90">
          ⚠️ This application is currently in development.
        </p>
        <button
          type="button"
          onClick={() => void openBabulTech()}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Owned &amp; developed by <span className="font-semibold">BabulTech</span>
          <ExternalLink className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
