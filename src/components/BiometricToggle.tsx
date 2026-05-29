import { useEffect, useState } from "react";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  isNativePlatform,
  isBiometricAvailable,
  isBiometricEnabled,
  enableBiometricLogin,
  disableBiometricLogin,
} from "@/lib/biometric";

/**
 * Lets the user turn biometric app-lock on/off. Visible only inside the
 * native shell on a device that has fingerprint / face enrolled.
 */
export function BiometricToggle() {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isNativePlatform()) return;
    void isBiometricAvailable().then(setAvailable);
    setEnabled(isBiometricEnabled());
  }, []);

  if (!isNativePlatform() || !available) return null; // hide on web / no biometry

  const enable = async () => {
    setBusy(true);
    const res = await enableBiometricLogin();
    setBusy(false);
    if (res.ok) {
      setEnabled(true);
      toast.success("Biometric lock enabled. You'll unlock Jancho with your fingerprint or face.");
    } else {
      toast.error(res.reason ?? "Could not enable biometric lock.");
    }
  };

  const disable = async () => {
    setBusy(true);
    await disableBiometricLogin();
    setBusy(false);
    setEnabled(false);
    toast.success("Biometric lock disabled on this device.");
  };

  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 flex items-center justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className={`rounded-xl p-2 ${enabled ? "bg-success/10 text-success" : "bg-muted/40 text-muted-foreground"}`}>
          {enabled ? <ShieldCheck className="size-4" /> : <Fingerprint className="size-4" />}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">Biometric lock</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {enabled
              ? "Enabled — Jancho asks for your fingerprint or face each time you open it."
              : "Unlock Jancho with your fingerprint or face instead of typing your password."}
          </div>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant={enabled ? "outline" : "default"}
        onClick={enabled ? disable : enable}
        disabled={busy}
        className="shrink-0"
      >
        {busy ? "…" : enabled ? "Disable" : "Enable"}
      </Button>
    </div>
  );
}
