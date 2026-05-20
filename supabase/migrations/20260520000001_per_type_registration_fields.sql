-- Per-participant-type registration field overrides.
-- The existing `registration_fields` column remains the global default
-- (used when participant_type is unset or unknown).
-- The new `registration_fields_by_type` column stores overrides per type,
-- e.g. { "student": {...}, "employee": {...} }.

ALTER TABLE public.host_settings
  ADD COLUMN IF NOT EXISTS registration_fields_by_type JSONB NOT NULL DEFAULT '{}'::jsonb;
