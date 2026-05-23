import { useState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { copyText } from "@/lib/copy-text";
import { InviteLinkDisplay } from "./invite-dialog/InviteLinkDisplay";

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

  // react-doctor-disable-next-line react-doctor/no-cascading-set-state
  useEffect(() => {
    if (!open) return;
    // react-doctor-disable-next-line react-doctor/no-chain-state-updates
    setBusy(true);
    // react-doctor-disable-next-line react-doctor/no-chain-state-updates
    setResults([]);
    // react-doctor-disable-next-line react-doctor/no-prop-callback-in-effect
    onGenerate([])
      .then((rows) => setResults(rows))
      .catch(() => {})
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onGenerate intentionally omitted; callers pass inline fns and including it would cause infinite re-runs
  }, [open]);

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

  const url = results[0]?.url ?? "";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setResults([]);
          setCopied(false);
        }
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
            <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Generating link…
          </div>
        ) : url ? (
          <InviteLinkDisplay url={url} copied={copied} onCopy={copy} />
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Failed to generate link. Close and try again.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
