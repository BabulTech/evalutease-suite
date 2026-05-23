import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy } from "lucide-react";

export function JoinPanel({
  joinUrl,
  accessCode,
  onCopy,
  size,
  showLink,
  statTiles,
}: {
  joinUrl: string;
  accessCode: string;
  onCopy: (text: string, label: string) => Promise<void>;
  size: number;
  showLink?: boolean;
  statTiles?: React.ReactNode;
}) {
  return (
    <div className="space-y-4 print:hidden">
      <div className="rounded-2xl border border-border bg-white p-4 flex flex-col items-center">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">Scan to join</div>
        <div className="mt-2">
          {joinUrl ? (
            <QRCodeSVG value={joinUrl} size={size} bgColor="#ffffff" fgColor="#000000" />
          ) : (
            <div
              className={`rounded-md bg-slate-100 ${size >= 188 ? "size-[188px]" : "size-[148px]"}`}
            />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Quiz PIN</div>
        <div className="mt-2 font-display text-4xl font-bold text-primary tracking-wider">
          {accessCode || "-"}
        </div>
        {accessCode && (
          <button
            type="button"
            onClick={() => onCopy(accessCode, "PIN")}
            className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Copy className="size-3" /> Copy PIN
          </button>
        )}
      </div>

      {showLink && joinUrl && (
        <div className="rounded-2xl border border-border bg-card/40 p-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Join link
          </div>
          <div className="mt-1 text-xs font-mono break-all text-foreground/90">{joinUrl}</div>
          <button
            type="button"
            onClick={() => onCopy(joinUrl, "Join link")}
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Copy className="size-3" /> Copy link
          </button>
        </div>
      )}

      {statTiles}
    </div>
  );
}

export function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "success";
}) {
  const color = tone === "primary" ? "text-primary" : "text-success";
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 text-center">
      <div className={`font-display text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] mt-1 uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
