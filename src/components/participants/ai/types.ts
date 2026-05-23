export type ExtractInput = {
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  hint?: string;
};

export type RawParticipant = {
  name: string;
  email?: string;
  mobile?: string;
  roll_number?: string;
  seat_number?: string;
  class?: string;
  organization?: string;
  address?: string;
  notes?: string;
};

export const SUPPORTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
