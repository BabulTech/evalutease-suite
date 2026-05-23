import { createServerFn } from "@tanstack/react-start";
import type { ParticipantDraft } from "../types";
import type { ExtractInput, RawParticipant } from "./types";
import { SUPPORTED_MEDIA_TYPES, MAX_IMAGE_BYTES } from "./types";
import { SYSTEM_PROMPT, SCHEMA } from "./prompts";
import { getClient, normalize } from "./client";

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
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: data.mediaType, data: data.imageBase64 },
            },
            { type: "text", text: userText },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text" || !textBlock.text)
      throw new Error("Claude returned no content");

    let parsed: { participants?: RawParticipant[] };
    try {
      parsed = JSON.parse(textBlock.text) as { participants?: RawParticipant[] };
    } catch (err) {
      throw new Error(`Could not parse Claude's response as JSON: ${(err as Error).message}`);
    }

    return normalize(parsed.participants ?? []);
  });
