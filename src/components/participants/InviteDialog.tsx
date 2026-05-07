import { useState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/copy-text";

export type InviteRow = { email: string | null; token: string; url: string };

type Props = {
  trigger: ReactNode;
  subtypeId: string;
  subtypeName: string;
  onGenerate: (emails: string[]) => Promise<InviteRow[]>;
};

export function InviteDialog({ trigger, subtypeName, onGenerate }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<InviteRow[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBusy(true);
    setResults([]);
    onGenerate([])
      .then((rows) => setResults(rows))
      .catch(() => {})
      .finally(() => setBusy(false));
  }, [open]);

  const copy = async (url: string) => {
    if (!url) return;
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error("Could not copy — select and copy manually");
    }
  };

  const url = results[0]?.url ?? "";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) { setResults([]); setCopied(false); }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite link</DialogTitle>
          <DialogDescription>
            Share this link with participants for{" "}
            <span className="font-semibold text-foreground">{subtypeName}</span>.
          </DialogDescription>
        </DialogHeader>

        {busy ? (
          <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground text-sm">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Generating link…
          </div>
        ) : url ? (
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-2xl border border-border bg-white p-3 shadow-card">
              <QRCodeSVG value={url} size={180} />
            </div>

            <div className="w-full flex items-center gap-2 rounded-xl border border-border bg-card/40 p-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 rounded-md bg-muted/30 px-3 py-2 font-mono text-xs text-foreground outline-none"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copy(url)}
                title="Copy link"
                className="shrink-0"
              >
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <Button
              onClick={() => copy(url)}
              className="w-full gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Failed to generate link. Close and try again.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
