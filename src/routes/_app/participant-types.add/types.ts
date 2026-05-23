import type { ParticipantType } from "@/components/participants/types";

export type TypeRow = { id: string; name: string };
export type SubRow = { id: string; type_id: string; name: string };
export type InviteRow = {
  email: string | null;
  token: string;
  url: string;
  participant_type?: string;
};

export type SupportedMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
export const SUPPORTED_IMG: SupportedMediaType[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
export const MAX_IMG = 5 * 1024 * 1024;
export const MAX_CSV = 1024 * 1024;

export const TYPE_OPTIONS: { value: ParticipantType; label: string; emoji: string }[] = [
  { value: "student", label: "Student", emoji: "🎓" },
  { value: "teacher", label: "Teacher", emoji: "📚" },
  { value: "employee", label: "Employee", emoji: "💼" },
  { value: "fun", label: "Fun / Guest", emoji: "🎉" },
];
