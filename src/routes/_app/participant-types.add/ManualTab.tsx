import { useRef, useState } from "react";
import { Check, CheckCircle, Loader2, UserPlus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DynamicParticipantFields } from "@/components/participants/DynamicParticipantFields";
import {
  emptyDraft,
  validateDraft,
  type ParticipantDraft,
  type ParticipantType,
} from "@/components/participants/types";
import { resolveRegistrationFields, type HostSettings } from "@/components/settings/host-settings";
import { TYPE_OPTIONS } from "./types";

export function ManualTab({
  typeId,
  hostSettings,
  ownerId,
  onSave,
}: {
  typeId: string;
  hostSettings: HostSettings;
  ownerId: string;
  onSave: (d: ParticipantDraft) => Promise<void>;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<ParticipantDraft>(() => emptyDraft());
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [emailCheck, setEmailCheck] = useState<"idle" | "checking" | "taken" | "available">("idle");
  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (patch: Partial<ParticipantDraft>) => {
    setDraft((p) => ({ ...p, ...patch }));
    if ("email" in patch) {
      const email = patch.email?.trim() ?? "";
      if (emailTimer.current) clearTimeout(emailTimer.current);
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setEmailCheck("idle");
        return;
      }
      setEmailCheck("checking");
      emailTimer.current = setTimeout(async () => {
        const { data: existing } = await supabase
          .from("participants")
          .select("id")
          .eq("owner_id", ownerId)
          .ilike("email", email)
          .maybeSingle();
        setEmailCheck(existing ? "taken" : "available");
      }, 600);
    }
  };

  const ptype = draft.participant_type;
  const fieldConfig = resolveRegistrationFields(hostSettings, ptype);

  const submit = async () => {
    const v = validateDraft(draft, fieldConfig);
    if (!v.ok) {
      toast.error(v.reason);
      return;
    }
    if (emailCheck === "taken") {
      toast.error("A participant with this email already exists.");
      return;
    }
    setBusy(true);
    try {
      await onSave(draft);
      setDraft(emptyDraft());
      setEmailCheck("idle");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      /* toast shown by caller */
    } finally {
      setBusy(false);
    }
  };

  if (!typeId)
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/30 py-10 text-center">
        <UserPlus className="mx-auto size-8 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">{t("ptAdd.selectTypeManual")}</p>
      </div>
    );

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-2 text-xs text-muted-foreground font-medium">
          {t("ptAdd.participantType")}
        </Label>
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() =>
                set({ participant_type: ptype === o.value ? "" : (o.value as ParticipantType) })
              }
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                ptype === o.value
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {o.emoji} {o.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-1.5">
          {t("ptAdd.name")} <span className="text-destructive">*</span>
        </Label>
        <Input
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder={t("ptAdd.fullName")}
        />
      </div>

      <DynamicParticipantFields draft={draft} fields={fieldConfig} onSet={set} />

      {draft.email && emailCheck !== "idle" && (
        <div
          className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
            emailCheck === "checking"
              ? "bg-muted/30 text-muted-foreground"
              : emailCheck === "taken"
                ? "bg-destructive/10 text-destructive border border-destructive/30"
                : "bg-success/10 text-success border border-success/30"
          }`}
        >
          {emailCheck === "checking" && <Loader2 size={13} className="animate-spin shrink-0" />}
          {emailCheck === "taken" && <XCircle size={13} className="shrink-0" />}
          {emailCheck === "available" && <CheckCircle size={13} className="shrink-0" />}
          {emailCheck === "checking" && "Checking email…"}
          {emailCheck === "taken" && "A participant with this email already exists."}
          {emailCheck === "available" && "Email is available ✓"}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            setDraft(emptyDraft());
            setEmailCheck("idle");
          }}
          disabled={busy}
        >
          {t("ptAdd.reset")}
        </Button>
        <Button
          onClick={submit}
          disabled={busy || emailCheck === "checking" || emailCheck === "taken"}
          className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
        >
          {saved ? (
            <>
              <Check className="size-4" /> {t("ptAdd.added")}
            </>
          ) : busy ? (
            t("ptAdd.saving")
          ) : (
            <>
              <UserPlus className="size-4" /> {t("ptAdd.addParticipant")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
