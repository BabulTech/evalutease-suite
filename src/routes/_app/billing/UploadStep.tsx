import { useRef } from "react";
import { Upload, CheckCircle2, Copy, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlanInfo } from "@/contexts/PlanContext";
import { StepHeader } from "./StepHeader";
import { METHOD_ICONS } from "./constants";
import type { PaymentAccount } from "./types";

type Props = {
  selectedPlan: PlanInfo;
  selectedMethod: string;
  accounts: PaymentAccount[];
  txRef: string;
  notes: string;
  screenshot: File | null;
  uploading: boolean;
  copied: string | null;
  onTxRefChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onScreenshotChange: (f: File | null) => void;
  onCopy: (text: string, key: string) => void;
  onSubmit: () => void;
  onBack: () => void;
};

export function UploadStep({
  selectedPlan,
  selectedMethod,
  accounts,
  txRef,
  notes,
  screenshot,
  uploading,
  copied,
  onTxRefChange,
  onNotesChange,
  onScreenshotChange,
  onCopy,
  onSubmit,
  onBack,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const acc = accounts.find((a) => a.method === selectedMethod);

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <StepHeader
        title="Send payment & upload proof"
        sub="Pay to the account below, then upload your screenshot"
        onBack={onBack}
      />

      {acc && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <span className="text-2xl">{METHOD_ICONS[acc.method]}</span>
              {acc.title}
            </div>
            <div className="font-display text-xl font-bold">PKR {selectedPlan.price_pkr}</div>
          </div>
          <div className="space-y-2">
            {[
              { key: "name", label: "Account Name", value: acc.account_name },
              { key: "number", label: "Account / IBAN", value: acc.account_number },
            ].map(({ key, label, value }) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-4 py-2.5"
              >
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {label}
                  </p>
                  <p className="font-semibold text-sm font-mono">{value}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onCopy(value, key)}
                  className="ml-3 p-2 rounded-lg hover:bg-muted/40 transition-colors"
                  aria-label={`Copy ${label}`}
                >
                  {copied === key ? (
                    <Check className="size-4 text-success" />
                  ) : (
                    <Copy className="size-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            ))}
          </div>
          {acc.instructions && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-xl p-3">
              <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
              {acc.instructions}
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold mb-2">
            Payment Screenshot <span className="text-destructive">*</span>
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            aria-label="Payment screenshot"
            className="hidden"
            onChange={(e) => onScreenshotChange(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`w-full rounded-2xl border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50 ${
              screenshot ? "border-success/50 bg-success/5" : "border-border bg-muted/10"
            }`}
          >
            {screenshot ? (
              <div className="space-y-1">
                <CheckCircle2 className="size-8 text-success mx-auto" />
                <p className="text-sm font-semibold text-success">{screenshot.name}</p>
                <p className="text-xs text-muted-foreground">Tap to change</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="size-8 text-muted-foreground/60 mx-auto" />
                <p className="text-sm font-medium">Tap to upload screenshot</p>
                <p className="text-xs text-muted-foreground">JPG · PNG · WebP up to 5 MB</p>
              </div>
            )}
          </button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            Transaction Reference{" "}
            <span className="text-muted-foreground font-normal">(optional but recommended)</span>
          </Label>
          <Input
            value={txRef}
            onChange={(e) => onTxRefChange(e.target.value)}
            placeholder="e.g. TXN-123456789"
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">
            Notes <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Any info for admin…"
            className="h-10"
          />
        </div>

        <Button
          onClick={onSubmit}
          disabled={!screenshot || uploading}
          className="w-full h-12 bg-gradient-primary text-primary-foreground shadow-glow gap-2 text-base font-semibold"
        >
          {uploading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin size-4 border-2 border-white/30 border-t-white rounded-full" />
              Submitting…
            </span>
          ) : (
            <>
              <Upload className="size-5" /> Submit Payment Proof
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
