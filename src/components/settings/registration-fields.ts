export const REGISTRATION_FIELD_KEYS = [
  "name",
  "email",
  "mobile",
  "roll_number",
  "seat_number",
  "class",
  "grade",
  "organization",
  "employee_id",
  "department",
  "address",
  "notes",
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
  grade: "Grade / year",
  organization: "Organization / school",
  employee_id: "Employee ID",
  department: "Department",
  address: "Address",
  notes: "Notes",
};

export const PARTICIPANT_TYPE_KEYS = ["default", "student", "teacher", "employee", "fun"] as const;
export type FieldTypeKey = (typeof PARTICIPANT_TYPE_KEYS)[number];

export const PARTICIPANT_TYPE_LABELS: Record<FieldTypeKey, string> = {
  default: "Default (unset / other)",
  student: "🎓 Student",
  teacher: "📚 Teacher",
  employee: "💼 Employee",
  fun: "🎉 Fun / Guest",
};

function makeDefaults(overrides: Partial<RegistrationFields> = {}): RegistrationFields {
  const base: RegistrationFields = {
    name: { visible: true, required: true },
    email: { visible: true, required: false },
    mobile: { visible: false, required: false },
    roll_number: { visible: false, required: false },
    seat_number: { visible: false, required: false },
    class: { visible: false, required: false },
    grade: { visible: false, required: false },
    organization: { visible: false, required: false },
    employee_id: { visible: false, required: false },
    department: { visible: false, required: false },
    address: { visible: false, required: false },
    notes: { visible: false, required: false },
  };
  return { ...base, ...overrides };
}

export const DEFAULT_REGISTRATION_FIELDS: RegistrationFields = makeDefaults({
  roll_number: { visible: true, required: false },
});

export const DEFAULT_FIELDS_BY_TYPE: Partial<Record<FieldTypeKey, RegistrationFields>> = {
  student: makeDefaults({
    roll_number: { visible: true, required: false },
    class: { visible: true, required: false },
    organization: { visible: true, required: false },
    seat_number: { visible: true, required: false },
  }),
  teacher: makeDefaults({
    employee_id: { visible: true, required: false },
    organization: { visible: true, required: false },
    class: { visible: true, required: false },
  }),
  employee: makeDefaults({
    employee_id: { visible: true, required: false },
    organization: { visible: true, required: false },
    department: { visible: true, required: false },
  }),
  fun: makeDefaults({
    notes: { visible: true, required: false },
    email: { visible: false, required: false },
  }),
};

function normalizeOne(value: unknown, fallback: RegistrationFields): RegistrationFields {
  const out = structuredClone(fallback);
  if (!value || typeof value !== "object") return out;
  const v = value as Record<string, unknown>;
  for (const key of REGISTRATION_FIELD_KEYS) {
    const entry = v[key];
    if (entry && typeof entry === "object") {
      const e = entry as { visible?: unknown; required?: unknown };
      const visible = e.visible === true;
      out[key] = { visible, required: e.required === true && visible };
    }
  }
  out.name = { visible: true, required: true };
  return out;
}

export function normalizeRegistrationFields(value: unknown): RegistrationFields {
  return normalizeOne(value, DEFAULT_REGISTRATION_FIELDS);
}

export function normalizeRegistrationFieldsByType(
  value: unknown,
): Partial<Record<FieldTypeKey, RegistrationFields>> {
  const out: Partial<Record<FieldTypeKey, RegistrationFields>> = {};
  if (!value || typeof value !== "object") return structuredClone(DEFAULT_FIELDS_BY_TYPE);
  const v = value as Record<string, unknown>;
  for (const key of PARTICIPANT_TYPE_KEYS) {
    if (key === "default") continue;
    if (v[key])
      out[key] = normalizeOne(v[key], DEFAULT_FIELDS_BY_TYPE[key] ?? DEFAULT_REGISTRATION_FIELDS);
  }
  return out;
}
