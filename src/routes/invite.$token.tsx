import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  emptyDraft,
  validateDraft,
  draftToRow,
  type ParticipantDraft,
  type ParticipantType,
} from "@/components/participants/types";

const TYPE_OPTIONS: { value: ParticipantType; label: string; emoji: string }[] = [
  { value: "student", label: "Student", emoji: "🎓" },
  { value: "teacher", label: "Teacher", emoji: "📚" },
  { value: "employee", label: "Employee", emoji: "💼" },
  { value: "fun", label: "Fun / Guest", emoji: "🎉" },
];

export const Route = createFileRoute("/invite/$token")({ component: InvitePage });

type InviteData = {
  invite: { id: string; status: string; email: string | null };
  type: { id: string; name: string; icon: string | null };
  subtype: { id: string; name: string };
};

type RpcResponse<T> = T | { error: string };

type Phase =
  | { kind: "loading" }
  | { kind: "ready"; data: InviteData }
  | { kind: "submitting"; data: InviteData }
  | { kind: "done"; data: InviteData; participantId: string }
  | { kind: "error"; message: string };

function InvitePage() {
  const { token } = Route.useParams();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [draft, setDraft] = useState<ParticipantDraft>(() => emptyDraft());

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
      setDraft((d) => ({ ...d, email: payload.invite.email ?? "" }));
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (phase.kind === "loading") {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-16">
          <div className="h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      </PageShell>
    );
  }

  if (phase.kind === "error") {
    return (
      <PageShell>
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
          <p className="mt-3 font-semibold">Invite unavailable</p>
          <p className="mt-1 text-sm text-muted-foreground">{phase.message}</p>
        </div>
      </PageShell>
    );
  }

  const data = phase.data;
  const alreadyRedeemed = data.invite.status === "accepted";

  if (phase.kind === "done" || alreadyRedeemed) {
    return (
      <PageShell>
        <div className="rounded-2xl border border-success/40 bg-success/10 p-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <p className="mt-3 font-semibold">You're in!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You've been added to <span className="font-medium text-foreground">{data.type.name}</span>{" "}
            → <span className="font-medium text-foreground">{data.subtype.name}</span>. Your host
            will share the quiz PIN when it's time to play.
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
    const row = draftToRow(draft, "00000000-0000-0000-0000-000000000000");
    setPhase({ kind: "submitting", data });
    const { data: rpcData, error } = await supabase.rpc("redeem_participant_invite", {
      p_token: token,
      p_name: row.name,
      p_email: row.email,
      p_mobile: row.mobile,
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
        payload.error === "already_redeemed"
          ? "This invite has already been used."
          : payload.error === "name_required"
            ? "Name is required."
            : "Could not redeem invite.";
      toast.error(msg);
      setPhase({ kind: "ready", data });
      return;
    }
    setPhase({ kind: "done", data, participantId: payload.participant_id });
  };

  const set = <K extends keyof ParticipantDraft>(key: K, value: ParticipantDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const busy = phase.kind === "submitting";

  return (
    <PageShell>
      <div className="rounded-2xl border border-border bg-card/60 p-6 md:p-8 shadow-card">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">You're invited to join</div>
        <h1 className="mt-1 font-display text-2xl font-bold">
          {data.type.name} → {data.subtype.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fill in your details below - your type and group are pre-selected.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {/* Type selector */}
          <div className="md:col-span-2">
            <Label className="mb-1.5">I am a…</Label>
            <Select
              value={draft.participant_type || "__none__"}
              onValueChange={(v) => set("participant_type", v === "__none__" ? "" : v as ParticipantType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select your role (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">- Not specified -</SelectItem>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.emoji} {o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name - always */}
          <div className="md:col-span-2">
            <Label className="mb-1.5">Name <span className="text-destructive">*</span></Label>
            <Input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" autoFocus maxLength={120} />
          </div>
          <div>
            <Label className="mb-1.5">Email</Label>
            <Input type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <Label className="mb-1.5">Mobile</Label>
            <Input type="tel" value={draft.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="+92 300 0000000" />
          </div>

          {/* Student / unset fields */}
          {(draft.participant_type === "student" || draft.participant_type === "") && (
            <>
              <div>
                <Label className="mb-1.5">School / Organization</Label>
                <Input value={draft.organization} onChange={(e) => set("organization", e.target.value)} placeholder="Babul Academy" />
              </div>
              <div>
                <Label className="mb-1.5">Class / Grade</Label>
                <Input value={draft.grade || draft.class} onChange={(e) => { set("grade", e.target.value); set("class", e.target.value); }} placeholder="Class 10 / Year 12" />
              </div>
              <div>
                <Label className="mb-1.5">Roll number</Label>
                <Input value={draft.roll_number} onChange={(e) => set("roll_number", e.target.value)} placeholder="2026-CS-042" />
              </div>
              <div>
                <Label className="mb-1.5">Seat number</Label>
                <Input value={draft.seat_number} onChange={(e) => set("seat_number", e.target.value)} />
              </div>
            </>
          )}

          {/* Teacher fields */}
          {draft.participant_type === "teacher" && (
            <>
              <div>
                <Label className="mb-1.5">Employee ID</Label>
                <Input value={draft.employee_id} onChange={(e) => set("employee_id", e.target.value)} placeholder="EMP-1234" />
              </div>
              <div>
                <Label className="mb-1.5">School / Institution</Label>
                <Input value={draft.organization} onChange={(e) => set("organization", e.target.value)} placeholder="Babul Academy" />
              </div>
              <div>
                <Label className="mb-1.5">Subject / Class</Label>
                <Input value={draft.class} onChange={(e) => set("class", e.target.value)} placeholder="Mathematics, Class 9–10" />
              </div>
            </>
          )}

          {/* Employee fields */}
          {draft.participant_type === "employee" && (
            <>
              <div>
                <Label className="mb-1.5">Employee ID</Label>
                <Input value={draft.employee_id} onChange={(e) => set("employee_id", e.target.value)} placeholder="EMP-1234" />
              </div>
              <div>
                <Label className="mb-1.5">Company / Organization</Label>
                <Input value={draft.organization} onChange={(e) => set("organization", e.target.value)} placeholder="Acme Corp" />
              </div>
              <div>
                <Label className="mb-1.5">Department</Label>
                <Input value={draft.department} onChange={(e) => set("department", e.target.value)} placeholder="Engineering" />
              </div>
            </>
          )}

          {/* Fun / Guest */}
          {draft.participant_type === "fun" && (
            <div>
              <Label className="mb-1.5">Nickname / Alias</Label>
              <Input value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. QuizMaster99" />
            </div>
          )}

          {draft.participant_type !== "fun" && (
            <div className="md:col-span-2">
              <Label className="mb-1.5">Notes</Label>
              <Textarea value={draft.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Anything worth noting" />
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={submit}
            disabled={busy}
            className="gap-2 bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <UserPlus className="h-4 w-4" />
            {busy ? "Submitting…" : "Join group"}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-center">
          <Logo />
        </div>
        {children}
      </div>
    </div>
  );
}
