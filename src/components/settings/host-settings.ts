import {
  DEFAULT_REGISTRATION_FIELDS,
  DEFAULT_FIELDS_BY_TYPE,
  type RegistrationFields,
  type FieldTypeKey,
} from "./registration-fields";

export type {
  RegistrationFieldKey,
  RegistrationFieldConfig,
  RegistrationFields,
  FieldTypeKey,
} from "./registration-fields";

export {
  REGISTRATION_FIELD_KEYS,
  REGISTRATION_FIELD_LABELS,
  PARTICIPANT_TYPE_KEYS,
  PARTICIPANT_TYPE_LABELS,
  DEFAULT_REGISTRATION_FIELDS,
  DEFAULT_FIELDS_BY_TYPE,
  normalizeRegistrationFields,
  normalizeRegistrationFieldsByType,
} from "./registration-fields";

export type HostSettings = {
  registration_fields: RegistrationFields;
  registration_fields_by_type: Partial<Record<FieldTypeKey, RegistrationFields>>;
  marks_per_correct: number;
  speed_bonus_enabled: boolean;
  speed_bonus_max: number;
  show_explanation: boolean;
};

export function defaultHostSettings(): HostSettings {
  return {
    registration_fields: structuredClone(DEFAULT_REGISTRATION_FIELDS),
    registration_fields_by_type: structuredClone(DEFAULT_FIELDS_BY_TYPE),
    marks_per_correct: 1,
    speed_bonus_enabled: false,
    speed_bonus_max: 1,
    show_explanation: true,
  };
}

export function resolveRegistrationFields(
  settings: Pick<HostSettings, "registration_fields" | "registration_fields_by_type">,
  participantType: string | null | undefined,
): RegistrationFields {
  const key = (participantType ?? "").trim();
  if (key && key in (settings.registration_fields_by_type ?? {})) {
    const override = settings.registration_fields_by_type[key as FieldTypeKey];
    if (override) return override;
  }
  return settings.registration_fields;
}
