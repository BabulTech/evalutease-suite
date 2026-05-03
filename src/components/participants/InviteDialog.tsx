import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Check, Copy, Mail, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type InviteRow = { email: string | null; token: string; url: string };

type Props = {
  trigger: ReactNode;
  subtypeId: string;
  subtypeName: string;
  /** Returns an array of newly created invite rows (one per email). */
  onGenerate: (emails: string[]) => Promise<InviteRow[]>;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteDialog({ trigger, subtypeName, onGenerate }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<InviteRow[]>([]);

  const reset = () => {
    setText("");
    setResults([]);
    setBusy(false);
  };

  const generate = async () => {
    const lines = text
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const invalid = lines.filter((e) => !EMAIL_RE.test(e));
    if (invalid.length) {
      toast.error(`These don't look like emails: ${invalid.join(", ")}`);
      return;
    }
    if (lines.length === 0) {
      // still allow link-without-email
      setBusy(true);
      try {
        const rows = await onGenerate([]);
        setResults(rows);
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const rows = await onGenerate(lines);
      setResults(rows);
      toast.success(`${rows.length} invite link${rows.length === 1 ? "" : "s"} generated`);
    } catch {
      // onGenerate handles its own toast
    } finally {
      setBusy(false);
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy — copy manually");
    }
  };

  const copyAll = async () => {
    if (results.length === 0) return;
    const lines = results.map((r) => (r.email ? `${r.email}  ${r.url}` : r.url));
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("All links copied");
    } catch {
      toast.error("Could not copy");
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
          <DialogTitle>Invite to {subtypeName}</DialogTitle>
          <DialogDescription>
            Generate per-participant invite links. Paste them into your email, WhatsApp, or any
            channel — when opened, the recipient sees a registration form already pinned to{" "}
            <span className="font-semibold text-foreground">{subtypeName}</span>.
          </DialogDescription>
        </DialogHeader>

        {results.length === 0 ? (
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5">Emails (one per line — optional)</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"alice@example.com\nbob@example.com"}
                rows={5}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Adding emails just labels each link — nothing is sent automatically. Leave empty to
                generate a single anonymous invite.
              </p>
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
                {busy ? "Generating…" : "Generate links"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-2 max-h-[40vh] overflow-y-auto">
              {results.map((r) => (
                <li
                  key={r.token}
                  className="rounded-xl border border-border bg-card/40 p-3 text-sm"
                >
                  {r.email && (
                    <div className="text-xs text-muted-foreground mb-1 truncate">{r.email}</div>
                  )}
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate text-xs bg-muted/30 px-2 py-1.5 rounded-md">
                      {r.url}
                    </code>
                    <Button size="icon" variant="ghost" onClick={() => copy(r.url)} title="Copy">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <DialogFooter className="flex-row justify-between sm:justify-between">
              <Button variant="ghost" onClick={reset}>
                <X className="h-4 w-4 mr-1" />
                Generate more
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={copyAll}>
                  <Check className="h-4 w-4 mr-1" />
                  Copy all
                </Button>
                <Button onClick={() => setOpen(false)}>Done</Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
