export const PARTICIPANT_NAME_MAX = 120;

export type ParticipantType = "student" | "teacher" | "employee" | "fun" | "";

export type ParticipantMeta = {
  participant_type?: ParticipantType;
  roll_number?: string;
  seat_number?: string;
  organization?: string;
  class?: string;
  grade?: string;
  employee_id?: string;
  department?: string;
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
  participant_type: ParticipantType;
  // student
  roll_number: string;
  seat_number: string;
  grade: string;
  // teacher + employee
  employee_id: string;
  // shared
  organization: string;
  class: string;
  department: string;
  address: string;
  notes: string;
};

export function emptyDraft(): ParticipantDraft {
  return {
    name: "",
    email: "",
    mobile: "",
    participant_type: "",
    roll_number: "",
    seat_number: "",
    grade: "",
    employee_id: "",
    organization: "",
    class: "",
    department: "",
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
    participant_type: p.metadata.participant_type ?? "",
    roll_number: p.metadata.roll_number ?? "",
    seat_number: p.metadata.seat_number ?? "",
    grade: p.metadata.grade ?? "",
    employee_id: p.metadata.employee_id ?? "",
    organization: p.metadata.organization ?? "",
    class: p.metadata.class ?? "",
    department: p.metadata.department ?? "",
    address: p.metadata.address ?? "",
    notes: p.metadata.notes ?? "",
  };
}

export function draftToRow(d: ParticipantDraft, ownerId: string) {
  const meta: ParticipantMeta = {};
  if (d.participant_type) meta.participant_type = d.participant_type;
  if (d.roll_number.trim()) meta.roll_number = d.roll_number.trim();
  if (d.seat_number.trim()) meta.seat_number = d.seat_number.trim();
  if (d.grade.trim()) meta.grade = d.grade.trim();
  if (d.employee_id.trim()) meta.employee_id = d.employee_id.trim();
  if (d.organization.trim()) meta.organization = d.organization.trim();
  if (d.class.trim()) meta.class = d.class.trim();
  if (d.department.trim()) meta.department = d.department.trim();
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
