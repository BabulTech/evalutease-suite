import { useState } from "react";
import { Check, Copy, Mail } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { copyText } from "@/lib/copy-text";
import type { InviteRow } from "./types";
import { TYPE_OPTIONS } from "./types";

export function InviteTab({
  subId,
  onGenerate,
}: {
  subId: string;
  onGenerate: (participantType?: string) => Promise<InviteRow | null>;
}) {
  const { t } = useI18n();
  const [invite, setInvite] = useState<InviteRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");

  const generate = async () => {
    setBusy(true);
    try {
      const row = await onGenerate(selectedType || undefined);
      if (row) setInvite(row);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (url: string) => {
    const ok = await copyText(url);
    if (ok) {
      setCopied(true);
      toast.success(t("ptAdd.linkCopied"));
      setTimeout(() => setCopied(false), 1500);
    } else toast.error("Could not copy");
  };

  if (!subId)
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/30 py-10 text-center">
        <Mail className="mx-auto size-8 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">{t("ptAdd.selectGroupInvite")}</p>
        <p className="text-xs text-muted-foreground mt-1">{t("ptAdd.inviteGroupNote")}</p>
      </div>
    );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("ptAdd.inviteDesc")}</p>

      {!invite ? (
        <div className="space-y-4">
          <div>
            <Label className="mb-2 text-xs text-muted-foreground font-medium">
              Participant type for this invite
            </Label>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setSelectedType(selectedType === o.value ? "" : o.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                    selectedType === o.value
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {o.emoji} {o.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Participant will see fields for the selected type. They cannot change this.
            </p>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={generate}
              disabled={busy}
              className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow px-8"
            >
              {busy ? (
                t("ptAdd.generating")
              ) : (
                <>
                  <Mail className="size-4" /> {t("ptAdd.generateInvite")}
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5">
          <div className="rounded-2xl border-2 border-border bg-white p-4 shadow-card">
            <QRCodeSVG value={invite.url} size={200} />
          </div>

          <div className="w-full max-w-md rounded-xl border border-border bg-card/40 p-3 flex items-center gap-2">
            <input
              readOnly
              aria-label="Invite link"
              value={invite.url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 bg-muted/30 rounded-md px-3 py-2 font-mono text-xs outline-none"
            />
            <Button size="sm" variant="ghost" onClick={() => copy(invite.url)}>
              {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
            </Button>
          </div>

          <div className="flex gap-2 w-full max-w-md">
            <Button
              onClick={() => copy(invite.url)}
              className="flex-1 gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
            >
              {copied ? (
                <>
                  <Check className="size-4" /> {t("ptAdd.copied")}
                </>
              ) : (
                <>
                  <Copy className="size-4" /> {t("ptAdd.copyLink")}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setInvite(null);
                setCopied(false);
              }}
            >
              {t("ptAdd.newLink")}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">{t("ptAdd.inviteSingleUse")}</p>
        </div>
      )}
    </div>
  );
}
