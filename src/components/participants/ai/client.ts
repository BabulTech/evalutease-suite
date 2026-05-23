import Anthropic from "@anthropic-ai/sdk";
import { emptyDraft, type ParticipantDraft } from "../types";
import type { RawParticipant } from "./types";

export function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    throw new Error(
      "Image extraction is not configured: ANTHROPIC_API_KEY is missing on the server.",
    );
  return new Anthropic({ apiKey });
}

export function normalize(rows: RawParticipant[]): ParticipantDraft[] {
  return rows.flatMap((r) => {
    if (!r || typeof r.name !== "string" || r.name.trim().length === 0) return [];
    const d = emptyDraft();
    d.name = r.name.trim();
    d.email = (r.email ?? "").trim();
    d.mobile = (r.mobile ?? "").trim();
    d.roll_number = (r.roll_number ?? "").trim();
    d.seat_number = (r.seat_number ?? "").trim();
    d.class = (r.class ?? "").trim();
    d.organization = (r.organization ?? "").trim();
    d.address = (r.address ?? "").trim();
    d.notes = (r.notes ?? "").trim();
    return [d];
  });
}
