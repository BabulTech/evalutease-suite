export const REGISTRATION_FIELD_KEYS = [
  "name",
  "email",
  "mobile",
  "roll_number",
  "seat_number",
  "class",
  "organization",
] as const;

export type RegistrationFieldKey = (typeof REGISTRATION_FIELD_KEYS)[number];

export type RegistrationFieldConfig = { visible: boolean; required: boolean };

export type RegistrationFields = Record<RegistrationFieldKey, RegistrationFieldConfig>;

export const REGISTRATION_FIELD_LABELS: Record<RegistrationFieldKey, string> = {
  name: "Name",
  email: "Email",
  mobile: "Contact number",
  roll_number: "Roll number",
  seat_number: "Seat number",
  class: "Class / grade",
  organization: "Organization / school",
};

export const DEFAULT_REGISTRATION_FIELDS: RegistrationFields = {
  name: { visible: true, required: true },
  email: { visible: true, required: false },
  mobile: { visible: false, required: false },
  roll_number: { visible: true, required: false },
  seat_number: { visible: false, required: false },
  class: { visible: false, required: false },
  organization: { visible: false, required: false },
};

export type HostSettings = {
  registration_fields: RegistrationFields;
  marks_per_correct: number;
  speed_bonus_enabled: boolean;
  speed_bonus_max: number;
  show_explanation: boolean;
};

export function defaultHostSettings(): HostSettings {
  return {
    registration_fields: structuredClone(DEFAULT_REGISTRATION_FIELDS),
    marks_per_correct: 1,
    speed_bonus_enabled: false,
    speed_bonus_max: 1,
    show_explanation: true,
  };
}

export function normalizeRegistrationFields(value: unknown): RegistrationFields {
  const out = structuredClone(DEFAULT_REGISTRATION_FIELDS);
  if (!value || typeof value !== "object") return out;
  const v = value as Record<string, unknown>;
  for (const key of REGISTRATION_FIELD_KEYS) {
    const entry = v[key];
    if (entry && typeof entry === "object") {
      const e = entry as { visible?: unknown; required?: unknown };
      const visible = e.visible === true;
      const required = e.required === true && visible;
      out[key] = { visible, required };
    }
  }
  // name is always visible+required — that's the minimum sane registration form
  out.name = { visible: true, required: true };
  return out;
}
