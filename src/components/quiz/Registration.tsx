import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  REGISTRATION_FIELD_LABELS,
  resolveRegistrationFields,
  type RegistrationFieldKey,
  type RegistrationFields,
  type FieldTypeKey,
} from "@/components/settings/host-settings";
import type { RegistrationValues, SessionPublic } from "./types";
import { TypePicker } from "./registration/TypePicker";
import { RegistrationFields as FieldsList } from "./registration/RegistrationFields";

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
    if (participantType)
      (submitValues as Record<string, string>).participant_type = participantType;
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
        <h1 className="mt-2 font-display text-2xl font-semibold leading-tight">{session.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Fill in your details to join. You'll wait in the lobby until the host starts the quiz.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {hasPerTypeConfig && <TypePicker value={participantType} onChange={setParticipantType} />}

        <FieldsList
          fields={resolvedFields}
          visibleKeys={visibleKeys}
          values={values}
          onChange={set}
        />
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
