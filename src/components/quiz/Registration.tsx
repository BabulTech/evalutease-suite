import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  REGISTRATION_FIELD_LABELS,
  resolveRegistrationFields,
  type RegistrationFieldKey,
  type RegistrationFields,
  type FieldTypeKey,
} from "@/components/settings/host-settings";
import type { RegistrationValues, SessionPublic } from "./types";

const TYPE_OPTIONS: { value: string; label: string; emoji: string }[] = [
  { value: "student",  label: "Student",    emoji: "🎓" },
  { value: "teacher",  label: "Teacher",    emoji: "📚" },
  { value: "employee", label: "Employee",   emoji: "💼" },
  { value: "fun",      label: "Fun / Guest", emoji: "🎉" },
];

type Props = {
  session: SessionPublic;
  fields: RegistrationFields;
  fieldsByType?: Partial<Record<FieldTypeKey, RegistrationFields>>;
  onSubmit: (values: RegistrationValues) => Promise<void>;
};

export function Registration({ session, fields, fieldsByType, onSubmit }: Props) {
  const [values, setValues] = useState<RegistrationValues>({});
  const [participantType, setParticipantType] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const hasPerTypeConfig = fieldsByType && Object.keys(fieldsByType).length > 0;

  const resolvedFields = resolveRegistrationFields(
    { registration_fields: fields, registration_fields_by_type: fieldsByType ?? {} },
    participantType,
  );

  const visibleKeys = (Object.keys(resolvedFields) as RegistrationFieldKey[]).filter(
    (k) => resolvedFields[k].visible,
  );

  const set = (key: RegistrationFieldKey, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    for (const key of visibleKeys) {
      if (resolvedFields[key].required && !values[key]?.trim()) {
        toast.error(`${REGISTRATION_FIELD_LABELS[key]} is required`);
        return;
      }
    }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      toast.error("Email looks invalid");
      return;
    }
    const submitValues = { ...values };
    if (participantType) (submitValues as Record<string, string>).participant_type = participantType;
    setSubmitting(true);
    try {
      await onSubmit(submitValues);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card/60 backdrop-blur p-6 sm:p-8 max-w-md w-full shadow-card">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Quiz · {session.access_code}
        </div>
        <h1 className="mt-2 font-display text-2xl font-bold leading-tight">{session.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fill in your details to join. You'll wait in the lobby until the host starts the quiz.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {/* Participant type selector — only shown when host has per-type configs */}
        {hasPerTypeConfig && (
          <div>
            <Label className="mb-2 text-xs text-muted-foreground font-medium">I am a…</Label>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setParticipantType(participantType === o.value ? "" : o.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[32px] ${
                    participantType === o.value
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {o.emoji} {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {visibleKeys.map((key) => (
          <div key={key}>
            <Label className="mb-1.5">
              {REGISTRATION_FIELD_LABELS[key]}
              {resolvedFields[key].required && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              value={values[key] ?? ""}
              onChange={(e) => set(key, e.target.value)}
              type={key === "email" ? "email" : key === "mobile" ? "tel" : "text"}
              placeholder={placeholderFor(key)}
              autoFocus={key === "name"}
              autoComplete={
                key === "email" ? "email" : key === "name" ? "name" : key === "mobile" ? "tel" : "off"
              }
            />
          </div>
        ))}
      </div>

      <Button
        onClick={submit}
        disabled={submitting}
        className="mt-6 w-full bg-gradient-primary text-primary-foreground shadow-glow"
      >
        {submitting ? "Joining…" : "Join the lobby"}
      </Button>
    </div>
  );
}

function placeholderFor(key: RegistrationFieldKey): string {
  const map: Partial<Record<RegistrationFieldKey, string>> = {
    name:         "Your full name",
    email:        "you@example.com",
    mobile:       "+92 300 0000000",
    roll_number:  "2026-CS-042",
    seat_number:  "A-12",
    class:        "Class 10",
    grade:        "Grade 10",
    organization: "Babul Academy",
    employee_id:  "EMP-1234",
    department:   "Engineering",
    address:      "Street, City",
    notes:        "Anything worth noting",
  };
  return map[key] ?? "";
}
