import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  REGISTRATION_FIELD_KEYS,
  REGISTRATION_FIELD_LABELS,
  type RegistrationFieldKey,
  type RegistrationFields,
} from "@/components/settings/host-settings";
import type { RegistrationValues, SessionPublic } from "./types";

type Props = {
  session: SessionPublic;
  fields: RegistrationFields;
  onSubmit: (values: RegistrationValues) => Promise<void>;
};

export function Registration({ session, fields, onSubmit }: Props) {
  const [values, setValues] = useState<RegistrationValues>({});
  const [submitting, setSubmitting] = useState(false);

  const visibleKeys = useMemo(
    () => REGISTRATION_FIELD_KEYS.filter((k) => fields[k].visible),
    [fields],
  );

  const set = (key: RegistrationFieldKey, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    for (const key of visibleKeys) {
      if (fields[key].required && !values[key]?.trim()) {
        toast.error(`${REGISTRATION_FIELD_LABELS[key]} is required`);
        return;
      }
    }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      toast.error("Email looks invalid");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(values);
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

      <div className="mt-6 space-y-3">
        {visibleKeys.map((key) => (
          <div key={key}>
            <Label className="mb-1.5">
              {REGISTRATION_FIELD_LABELS[key]}
              {fields[key].required && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              value={values[key] ?? ""}
              onChange={(e) => set(key, e.target.value)}
              type={key === "email" ? "email" : key === "mobile" ? "tel" : "text"}
              placeholder={placeholderFor(key)}
              autoFocus={key === "name"}
              autoComplete={
                key === "email"
                  ? "email"
                  : key === "name"
                    ? "name"
                    : key === "mobile"
                      ? "tel"
                      : "off"
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
  switch (key) {
    case "name":
      return "Your full name";
    case "email":
      return "you@example.com";
    case "mobile":
      return "+92 300 0000000";
    case "roll_number":
      return "2026-CS-042";
    case "seat_number":
      return "A-12";
    case "class":
      return "Class 10";
    case "organization":
      return "Babul Academy";
  }
}
