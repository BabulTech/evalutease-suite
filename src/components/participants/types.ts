export const PARTICIPANT_NAME_MAX = 120;

export type ParticipantMeta = {
  roll_number?: string;
  seat_number?: string;
  organization?: string;
  class?: string;
  address?: string;
  notes?: string;
};

export type Participant = {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  metadata: ParticipantMeta;
  created_at: string;
};

export type ParticipantDraft = {
  name: string;
  email: string;
  mobile: string;
  roll_number: string;
  seat_number: string;
  organization: string;
  class: string;
  address: string;
  notes: string;
};

export function emptyDraft(): ParticipantDraft {
  return {
    name: "",
    email: "",
    mobile: "",
    roll_number: "",
    seat_number: "",
    organization: "",
    class: "",
    address: "",
    notes: "",
  };
}

export type DraftValidation = { ok: true } | { ok: false; reason: string };

export function validateDraft(d: ParticipantDraft): DraftValidation {
  const name = d.name.trim();
  if (!name) return { ok: false, reason: "Name is required" };
  if (name.length > PARTICIPANT_NAME_MAX)
    return { ok: false, reason: `Name must be ≤ ${PARTICIPANT_NAME_MAX} characters` };
  const email = d.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, reason: "Email looks invalid" };
  return { ok: true };
}

export function draftFromParticipant(p: Participant): ParticipantDraft {
  return {
    name: p.name ?? "",
    email: p.email ?? "",
    mobile: p.mobile ?? "",
    roll_number: p.metadata.roll_number ?? "",
    seat_number: p.metadata.seat_number ?? "",
    organization: p.metadata.organization ?? "",
    class: p.metadata.class ?? "",
    address: p.metadata.address ?? "",
    notes: p.metadata.notes ?? "",
  };
}

export function draftToRow(d: ParticipantDraft, ownerId: string) {
  const meta: ParticipantMeta = {};
  if (d.roll_number.trim()) meta.roll_number = d.roll_number.trim();
  if (d.seat_number.trim()) meta.seat_number = d.seat_number.trim();
  if (d.organization.trim()) meta.organization = d.organization.trim();
  if (d.class.trim()) meta.class = d.class.trim();
  if (d.address.trim()) meta.address = d.address.trim();
  if (d.notes.trim()) meta.notes = d.notes.trim();
  return {
    owner_id: ownerId,
    name: d.name.trim(),
    email: d.email.trim() || null,
    mobile: d.mobile.trim() || null,
    metadata: meta,
  };
}
