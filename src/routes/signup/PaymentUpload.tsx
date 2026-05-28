import { useRef, useState } from "react";
import { ChevronRight, ChevronLeft, Upload, X, FileImage, ShieldCheck, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAYMENT_ACCOUNTS = [
  {
    id: "easypaisa",
    method: "EasyPaisa",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/30",
    icon: "🟢",
    accountName: "Muhammad Ali Raza",
    accountNumber: "03001234567",
  },
  {
    id: "jazzcash",
    method: "JazzCash",
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/30",
    icon: "🔴",
    accountName: "Muhammad Ali Raza",
    accountNumber: "03001234567",
  },
  {
    id: "bank_transfer",
    method: "Bank Transfer",
    color: "text-primary",
    bg: "bg-primary/10 border-primary/30",
    icon: "🏦",
    accountName: "Muhammad Ali Raza",
    accountNumber: "0123456789012345",
    extra: "HBL - Branch: Lahore Main",
  },
] as const;

export type PaymentMethodId = (typeof PAYMENT_ACCOUNTS)[number]["id"];

async function compressImage(file: File, maxPx = 1600, quality = 0.75): Promise<File> {
  // PDFs pass through unchanged
  if (file.type === "application/pdf") return file;

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Compression failed")); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
      title="Copy"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  );
}

interface PaymentUploadProps {
  isNgo: boolean;
  paymentFile: File | null;
  ngoFile: File | null;
  paymentMethod: PaymentMethodId | null;
  onPaymentFile: (f: File | null) => void;
  onNgoFile: (f: File | null) => void;
  onPaymentMethod: (m: PaymentMethodId) => void;
  onContinue: () => void;
  onBack: () => void;
}

function FileDropZone({
  label,
  hint,
  file,
  onChange,
  accent = "primary",
}: {
  label: string;
  hint: string;
  file: File | null;
  onChange: (f: File | null) => void;
  accent?: "primary" | "emerald";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  const handleFile = async (raw: File) => {
    if (raw.size > 5 * 1024 * 1024) { alert("File too large. Max 5MB."); return; }
    setCompressing(true);
    try {
      const compressed = await compressImage(raw);
      onChange(compressed);
    } catch {
      onChange(raw); // fallback to original if compression fails
    } finally {
      setCompressing(false);
    }
  };
  const color = accent === "emerald" ? "border-emerald-400/50 hover:border-emerald-400" : "border-primary/50 hover:border-primary";
  const activeColor = accent === "emerald" ? "border-emerald-400 bg-emerald-400/5" : "border-primary bg-primary/5";

  return (
    <div>
      <p className="text-sm font-semibold mb-2">{label}</p>
      <p className="text-xs text-muted-foreground mb-3">{hint}</p>
      {compressing ? (
        <div className={`flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 ${color}`}>
          <div className="size-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Compressing…</p>
        </div>
      ) : file ? (
        <div className={`flex items-center gap-3 rounded-2xl border p-4 ${activeColor}`}>
          <FileImage size={20} className={accent === "emerald" ? "text-emerald-400" : "text-primary"} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {file.size < 1024 * 1024
                ? `${(file.size / 1024).toFixed(1)} KB`
                : `${(file.size / (1024 * 1024)).toFixed(2)} MB`}
              {" · compressed"}
            </p>
          </div>
          <button
            type="button"
            title="Remove file"
            onClick={() => onChange(null)}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`w-full rounded-2xl border-2 border-dashed p-6 flex flex-col items-center gap-2 transition-all ${color}`}
        >
          <Upload size={20} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Click to upload</p>
          <p className="text-xs text-muted-foreground/60">PNG, JPG, PDF (max 5MB)</p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        title="Upload file"
        aria-label={label}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function PaymentUpload({
  isNgo,
  paymentFile,
  ngoFile,
  paymentMethod,
  onPaymentFile,
  onNgoFile,
  onPaymentMethod,
  onContinue,
  onBack,
}: PaymentUploadProps) {
  const canContinue =
    paymentFile !== null &&
    paymentMethod !== null &&
    (!isNgo || ngoFile !== null);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-secondary/40 border border-border p-4 flex items-start gap-3">
        <ShieldCheck size={18} className="text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Upload your payment screenshot. Our team reviews and activates your plan within{" "}
          <span className="text-foreground font-medium">24 hours</span>. Until then you'll be on the Free plan.
        </p>
      </div>

      {/* Payment account details - click to pick the method you used */}
      <div className="space-y-2">
        <p className="text-sm font-semibold">Select Method &amp; Send Payment</p>
        <p className="text-xs text-muted-foreground">Tap the method you paid with (required).</p>
        <div className="space-y-2">
          {PAYMENT_ACCOUNTS.map((acc) => {
            const selected = paymentMethod === acc.id;
            return (
              <button
                type="button"
                key={acc.id}
                onClick={() => onPaymentMethod(acc.id)}
                className={`w-full text-left rounded-xl border p-3 transition-all ${acc.bg} ${selected ? "ring-2 ring-primary border-primary" : "opacity-80 hover:opacity-100"}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-bold ${acc.color}`}>{acc.icon} {acc.method}</span>
                  {selected && <Check size={14} className="text-primary" />}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center">
                    <span className="w-24 shrink-0">Account Name</span>
                    <span className="font-medium text-foreground">{acc.accountName}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-24 shrink-0">Number / IBAN</span>
                    <span className="font-mono font-semibold text-foreground">{acc.accountNumber}</span>
                    <CopyButton text={acc.accountNumber} />
                  </div>
                  {"extra" in acc && acc.extra && (
                    <div className="flex items-center">
                      <span className="w-24 shrink-0">Details</span>
                      <span className="text-foreground/70">{acc.extra}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <FileDropZone
        label="Payment Screenshot"
        hint="Take a screenshot of your EasyPaisa / JazzCash / bank transfer and upload it here."
        file={paymentFile}
        onChange={onPaymentFile}
        accent="primary"
      />

      {isNgo && (
        <FileDropZone
          label="NGO / Non-profit Certificate"
          hint="Upload your official NGO registration certificate or letterhead for 50% discount verification."
          file={ngoFile}
          onChange={onNgoFile}
          accent="emerald"
        />
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-12 px-4" onClick={onBack}>
          <ChevronLeft size={16} />
        </Button>
        <Button
          type="button"
          className="flex-1 h-12 bg-gradient-primary font-semibold shadow-glow text-base"
          onClick={onContinue}
          disabled={!canContinue}
        >
          Create Account <ChevronRight size={16} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}
