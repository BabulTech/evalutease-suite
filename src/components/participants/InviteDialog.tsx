import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Check, Copy, Link2, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  /** Empty input creates one reusable common invite link. */
  onGenerate: (emails: string[]) => Promise<InviteRow[]>;
};

export function InviteDialog({ trigger, subtypeName, onGenerate }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<InviteRow[]>([]);

  const reset = () => {
    setResults([]);
    setBusy(false);
  };

  const generate = async () => {
    setBusy(true);
    try {
      const rows = await onGenerate([]);
      setResults(rows);
      toast.success("Invite link generated");
    } catch {
      // onGenerate handles its own toast
    } finally {
      setBusy(false);
    }
  };

  const [copied, setCopied] = useState(false);

  const copy = async (url: string) => {
    if (!url) return;
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error("Could not copy - select and copy manually");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Common invite link</DialogTitle>
          <DialogDescription>
            Generate one reusable URL for{" "}
            <span className="font-semibold text-foreground">{subtypeName}</span>. Students open it,
            fill the form, and appear in this participant list.
          </DialogDescription>
        </DialogHeader>

        {results.length === 0 ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-card/40 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">
                  <Link2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-semibold">No email list needed</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The teacher copies one URL and shares it anywhere. Every student who fills it is
                    saved under this group.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                onClick={generate}
                disabled={busy}
                className="bg-gradient-primary text-primary-foreground shadow-glow"
              >
                <Mail className="h-4 w-4 mr-1" />
                {busy ? "Generating..." : "Generate URL"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map((r) => (
              <div
                key={r.token}
                className="flex items-center gap-2 rounded-xl border border-border bg-card/40 p-2"
              >
                <input
                  readOnly
                  value={r.url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 rounded-md bg-muted/30 px-3 py-2 font-mono text-xs text-foreground outline-none"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copy(r.url)}
                  title="Copy link"
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2 sm:space-x-0">
              <Button variant="ghost" size="sm" onClick={reset}>
                Create new
              </Button>
              <Button
                onClick={() => copy(results[0]?.url ?? "")}
                className="gap-1.5 bg-gradient-primary text-primary-foreground shadow-glow"
              >
                <Check className="h-4 w-4" />
                {copied ? "Copied" : "Copy URL"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
