import { Check, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";

type Props = {
  url: string;
  copied: boolean;
  onCopy: (url: string) => void;
};

export function InviteLinkDisplay({ url, copied, onCopy }: Props) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="rounded-2xl border border-border bg-white p-3 shadow-card">
        <QRCodeSVG value={url} size={180} />
      </div>

      <div className="w-full flex items-center gap-2 rounded-xl border border-border bg-card/40 p-2">
        <input
          readOnly
          aria-label="Invite link"
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 rounded-md bg-muted/30 px-3 py-2 font-mono text-xs text-foreground outline-none"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onCopy(url)}
          title="Copy link"
          className="shrink-0"
        >
          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
        </Button>
      </div>

      <Button
        onClick={() => onCopy(url)}
        className="w-full gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copied!" : "Copy Link"}
      </Button>
    </div>
  );
}
