import { createServerFn } from "@tanstack/react-start";
import Anthropic from "@anthropic-ai/sdk";
import { emptyDraft, type ParticipantDraft } from "./types";

type ExtractInput = {
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  hint?: string;
};

const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const SYSTEM_PROMPT = `You are an expert at reading printed and handwritten rosters / attendance sheets and turning them into structured participant data.

Your job:
- Read the image and identify each person listed.
- For each person extract: name (required), email, mobile (phone), roll_number, seat_number, class, organization (school / company), address, notes.
- Skip column headings, decorative text, page numbers — only return real entries.
- If a field is missing, leave the string empty. Don't invent data.

Return ONLY JSON matching the requested schema. No prose, markdown, or code fences.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["participants"],
  properties: {
    participants: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name"],
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          mobile: { type: "string" },
          roll_number: { type: "string" },
          seat_number: { type: "string" },
          class: { type: "string" },
          organization: { type: "string" },
          address: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
  },
} as const;

type RawParticipant = {
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

function normalize(rows: RawParticipant[]): ParticipantDraft[] {
  return rows
    .filter((r) => r && typeof r.name === "string" && r.name.trim().length > 0)
    .map((r) => {
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
      return d;
    });
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Image extraction is not configured: ANTHROPIC_API_KEY is missing on the server.");
  }
  return new Anthropic({ apiKey });
}

export const extractParticipantsFromImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown): ExtractInput => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid request body");
    const v = data as Record<string, unknown>;
    const imageBase64 = typeof v.imageBase64 === "string" ? v.imageBase64 : "";
    const mediaType = v.mediaType as ExtractInput["mediaType"];
    const hint = typeof v.hint === "string" ? v.hint : "";
    if (!imageBase64) throw new Error("imageBase64 is required");
    if (!SUPPORTED_MEDIA_TYPES.includes(mediaType))
      throw new Error(`mediaType must be one of: ${SUPPORTED_MEDIA_TYPES.join(", ")}`);
    if (imageBase64.length > MAX_IMAGE_BYTES)
      throw new Error(`Image is too large (max ~${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB)`);
    return { imageBase64, mediaType, hint };
  })
  .handler(async ({ data }): Promise<ParticipantDraft[]> => {
    const client = getClient();

    const userText = [
      "Extract every participant / student listed in this image as structured data.",
      data.hint ? `Additional context from the user: ${data.hint}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: data.mediaType,
                data: data.imageBase64,
              },
            },
            { type: "text", text: userText },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text" || !textBlock.text) {
      throw new Error("Claude returned no content");
    }
    let parsed: { participants?: RawParticipant[] };
    try {
      parsed = JSON.parse(textBlock.text) as { participants?: RawParticipant[] };
    } catch (err) {
      throw new Error(`Could not parse Claude's response as JSON: ${(err as Error).message}`);
    }
    return normalize(parsed.participants ?? []);
  });
