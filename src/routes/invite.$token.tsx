import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, UserPlus, Loader2, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DynamicParticipantFields } from "@/components/participants/DynamicParticipantFields";
import {
  emptyDraft,
  validateDraft,
  draftToRow,
  type ParticipantDraft,
} from "@/components/participants/types";
import {
  normalizeRegistrationFields,
  normalizeRegistrationFieldsByType,
  resolveRegistrationFields,
  PARTICIPANT_TYPE_LABELS,
} from "@/components/settings/host-settings";
import { PageShell } from "./invite/PageShell";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/invite/$token")({ component: InvitePage });

type InviteData = {
  invite: { id: string; status: string; email: string | null };
  type: { id: string; name: string; icon: string | null };
  subtype: { id: string; name: string };
  participant_type?: string | null;
  host_registration_fields?: unknown;
  host_fields_by_type?: unknown;
};

type RpcResponse<T> = T | { error: string };

type Phase =
  | { kind: "loading" }
  | { kind: "ready"; data: InviteData }
  | { kind: "submitting"; data: InviteData }
  | { kind: "done"; data: InviteData; participantId: string }
  | { kind: "error"; message: string };

// react-doctor-disable-next-line react-doctor/only-export-components
function InvitePage() {
  const { token } = Route.useParams();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [draft, setDraft] = useState<ParticipantDraft>(() => emptyDraft());
  const [emailCheck, setEmailCheck] = useState<"idle" | "checking" | "taken" | "available">("idle");
  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_invite_for_token", { p_token: token });
    if (error) {
      setPhase({ kind: "error", message: error.message });
      return;
    }
    const payload = data as RpcResponse<InviteData>;
    if ("error" in payload) {
      setPhase({
        kind: "error",
        message:
          payload.error === "not_found"
            ? "This invite link is invalid or has been revoked."
            : "Could not load this invite.",
      });
      return;
    }
    setPhase({ kind: "ready", data: payload });
    if (payload.invite.email) {
      const prefillEmail = payload.invite.email;
      setDraft((d) => ({ ...d, email: prefillEmail }));
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prefillEmail)) {
        setEmailCheck("checking");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not yet in generated Supabase types
        const { data: exists } = await (supabase as any).rpc("check_participant_email_in_subtype", {
          p_subtype_id: payload.subtype.id,
          p_email: prefillEmail,
        });
        setEmailCheck(exists ? "taken" : "available");
      }
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // suppress unused warning – emailTimer used for future debounce extensions
  void emailTimer;

  if (phase.kind === "loading") {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-16">
          <div className="size-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      </PageShell>
    );
  }

  if (phase.kind === "error") {
    return (
      <PageShell>
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center">
          <AlertTriangle className="mx-auto size-10 text-destructive" />
          <p className="mt-3 font-semibold">Invite unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">{phase.message}</p>
        </div>
      </PageShell>
    );
  }

  const data = phase.data;
  if (phase.kind === "done") {
    return (
      <PageShell>
        <div className="rounded-2xl border border-success/40 bg-success/10 p-8 text-center">
          <CheckCircle2 className="mx-auto size-10 text-success" />
          <p className="mt-3 font-semibold">You're in!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You've been added to{" "}
            <span className="font-medium text-foreground">{data.type.name}</span> →{" "}
            <span className="font-medium text-foreground">{data.subtype.name}</span>. Your host will
            share the quiz PIN when it's time to play.
          </p>
        </div>
      </PageShell>
    );
  }

  const submit = async () => {
    const v = validateDraft(draft);
    if (!v.ok) {
      toast.error(v.reason);
      return;
    }
    if (emailCheck === "taken") {
      toast.error("A participant with this email is already in this group.");
      return;
    }
    const row = draftToRow(draft, "00000000-0000-0000-0000-000000000000");
    setPhase({ kind: "submitting", data });
    const { data: rpcData, error } = await supabase.rpc("redeem_participant_invite", {
      p_token: token,
      p_name: row.name,
      p_email: row.email ?? undefined,
      p_mobile: row.mobile ?? undefined,
      p_metadata: row.metadata,
    });
    if (error) {
      toast.error(error.message);
      setPhase({ kind: "ready", data });
      return;
    }
    const payload = rpcData as RpcResponse<{ participant_id: string }>;
    if ("error" in payload) {
      const msg =
        payload.error === "revoked"
          ? "This invite link has been revoked by the host."
          : payload.error === "name_required"
            ? "Name is required."
            : payload.error === "email_taken"
              ? "A participant with this email is already in this group."
              : "Could not redeem invite.";
      toast.error(msg);
      setPhase({ kind: "ready", data });
      return;
    }
    setPhase({ kind: "done", data, participantId: payload.participant_id });
  };

  const set = (patch: Partial<ParticipantDraft>) => setDraft((prev) => ({ ...prev, ...patch }));
  const busy = phase.kind === "submitting";
  const lockedType = data.participant_type ?? "";
  const hostSettings = {
    registration_fields: normalizeRegistrationFields(data.host_registration_fields),
    registration_fields_by_type: normalizeRegistrationFieldsByType(data.host_fields_by_type),
  };
  const fieldConfig = resolveRegistrationFields(hostSettings, lockedType);
  const lockedTypeLabel = lockedType
    ? PARTICIPANT_TYPE_LABELS[lockedType as keyof typeof PARTICIPANT_TYPE_LABELS]
    : undefined;

  return (
    <PageShell>
      <div className="rounded-2xl border border-border bg-card/60 p-6 md:p-8 shadow-card">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          You're invited to join
        </div>
        <h1 className="mt-1 font-display text-2xl font-semibold">
          {data.type.name} → {data.subtype.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fill in your details below to join the group.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <Label className="mb-1.5">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Full name"
              maxLength={120}
            />
          </div>

          <DynamicParticipantFields
            draft={draft}
            fields={fieldConfig}
            onSet={set}
            lockedTypeLabel={lockedTypeLabel}
          />

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
              {emailCheck === "taken" && "This email is already registered in this group."}
              {emailCheck === "available" && "Email is available ✓"}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={submit}
            disabled={busy || emailCheck === "checking" || emailCheck === "taken"}
            className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            {busy ? "Submitting…" : emailCheck === "checking" ? "Checking…" : "Join group"}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
