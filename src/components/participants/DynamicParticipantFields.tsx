import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  REGISTRATION_FIELD_LABELS,
  type RegistrationFields,
} from "@/components/settings/host-settings";
import type { ParticipantDraft } from "./types";

// Maps a RegistrationFieldKey to how it reads/writes into ParticipantDraft.
type FieldMapping = {
  get: (d: ParticipantDraft) => string;
  set: (val: string) => Partial<ParticipantDraft>;
  inputType?: string;
  placeholder?: string;
  multiline?: boolean;
};

const FIELD_MAP: Record<string, FieldMapping> = {
  email: {
    get: (d) => d.email,
    set: (v) => ({ email: v }),
    inputType: "email",
    placeholder: "participant@example.com",
  },
  mobile: {
    get: (d) => d.mobile,
    set: (v) => ({ mobile: v }),
    inputType: "tel",
    placeholder: "+92 300 0000000",
  },
  roll_number: {
    get: (d) => d.roll_number,
    set: (v) => ({ roll_number: v }),
    placeholder: "2026-CS-042",
  },
  seat_number: {
    get: (d) => d.seat_number,
    set: (v) => ({ seat_number: v }),
    placeholder: "A-12",
  },
  class: {
    get: (d) => d.class,
    set: (v) => ({ class: v }),
    placeholder: "Class 10 / Year 12",
  },
  grade: {
    get: (d) => d.grade,
    set: (v) => ({ grade: v }),
    placeholder: "Grade 10",
  },
  organization: {
    get: (d) => d.organization,
    set: (v) => ({ organization: v }),
    placeholder: "Babul Academy",
  },
  employee_id: {
    get: (d) => d.employee_id,
    set: (v) => ({ employee_id: v }),
    placeholder: "EMP-1234",
  },
  department: {
    get: (d) => d.department,
    set: (v) => ({ department: v }),
    placeholder: "Engineering",
  },
  address: {
    get: (d) => d.address,
    set: (v) => ({ address: v }),
    placeholder: "Street, City",
  },
  notes: {
    get: (d) => d.notes,
    set: (v) => ({ notes: v }),
    placeholder: "Anything worth noting",
    multiline: true,
  },
};

type Props = {
  draft: ParticipantDraft;
  fields: RegistrationFields;
  onSet: (patch: Partial<ParticipantDraft>) => void;
  /** Show locked type badge (for invite page where host pre-selected the type) */
  lockedTypeLabel?: string;
};

export function DynamicParticipantFields({ draft, fields, onSet, lockedTypeLabel }: Props) {
  const visibleKeys = (Object.keys(FIELD_MAP) as string[]).filter(
    (key) => fields[key as keyof RegistrationFields]?.visible,
  );

  if (visibleKeys.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {lockedTypeLabel && (
        <div className="md:col-span-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {lockedTypeLabel}
          </span>
        </div>
      )}

      {visibleKeys.map((key) => {
        const mapping = FIELD_MAP[key];
        const cfg = fields[key as keyof RegistrationFields];
        const label = REGISTRATION_FIELD_LABELS[key as keyof RegistrationFields];
        const required = cfg?.required ?? false;
        const val = mapping.get(draft);

        if (mapping.multiline) {
          return (
            <div key={key} className="md:col-span-2">
              <Label className="mb-1.5">
                {label}
                {required && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              <Textarea
                value={val}
                onChange={(e) => onSet(mapping.set(e.target.value))}
                placeholder={mapping.placeholder}
                rows={2}
              />
            </div>
          );
        }

        return (
          <div key={key}>
            <Label className="mb-1.5">
              {label}
              {required && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            <Input
              type={mapping.inputType ?? "text"}
              value={val}
              onChange={(e) => onSet(mapping.set(e.target.value))}
              placeholder={mapping.placeholder}
            />
          </div>
        );
      })}
    </div>
  );
}
