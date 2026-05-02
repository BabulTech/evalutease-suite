import { createServerFn } from "@tanstack/react-start";
import Anthropic from "@anthropic-ai/sdk";
import { emptyDraft, MAX_QUESTION_LENGTH, type Difficulty, type DraftQuestion } from "./types";

type GenerateInput = {
  topic: string;
  count: number;
  difficulty: Difficulty;
  language?: string;
};

type ExtractInput = {
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  hint?: string;
  difficulty?: Difficulty;
};

const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const SYSTEM_PROMPT = `You are an expert quiz author. Produce high-quality multiple-choice questions for teachers and students. Every question must:
- be a clear, single-sentence stem of at most ${MAX_QUESTION_LENGTH} characters,
- have exactly four options,
- have exactly one correct answer (correctIndex is 0..3),
- avoid "all of the above" / "none of the above",
- include a one-sentence explanation of the correct answer.

Return ONLY JSON matching the requested schema. No prose, markdown, or code fences.`;

const SYSTEM_PROMPT_SCAN = `You are an expert at reading printed and handwritten quiz/exam pages and turning them into clean MCQs.

Your job:
- Read the user's image and identify all multiple-choice questions on it.
- For each question return: a stem (≤ ${MAX_QUESTION_LENGTH} chars), four options, the index (0..3) of the correct answer, and a short explanation.
- If the page has fewer or more than four options for a question, normalise to four — keep the most plausible options and drop the rest, or generate plausible distractors only if necessary to reach four.
- If the correct answer isn't marked on the page, use your knowledge to infer it.
- If you cannot find any questions on the page, return an empty array.

Do not impose any rigid input format on the user — extract from whatever is in the image. Return ONLY JSON matching the requested schema. No prose, markdown, or code fences.`;

// JSON-schema constraints supported by Anthropic structured outputs are
// intentionally minimal. minItems/maxItems other than 0/1, and numeric
// minimum/maximum, are NOT supported and 400 if used. We validate those
// constraints in code below instead.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "options", "correctIndex", "explanation"],
        properties: {
          text: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" },
          },
          correctIndex: { type: "integer" },
          explanation: { type: "string" },
        },
      },
    },
  },
} as const;

type RawQuestion = {
  text: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

function normalizeRows(rows: RawQuestion[], difficulty: Difficulty): DraftQuestion[] {
  return rows.map((q): DraftQuestion => {
    const draft = emptyDraft(difficulty);
    draft.text = String(q.text ?? "").slice(0, MAX_QUESTION_LENGTH);
    const opts = Array.isArray(q.options) ? q.options.slice(0, 4) : [];
    while (opts.length < 4) opts.push("");
    draft.options = opts.map((o) => String(o ?? ""));
    draft.correctIndex =
      Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4
        ? q.correctIndex
        : 0;
    draft.explanation = String(q.explanation ?? "");
    return draft;
  });
}

function parseQuestions(text: string): RawQuestion[] {
  let parsed: { questions?: RawQuestion[] };
  try {
    parsed = JSON.parse(text) as { questions?: RawQuestion[] };
  } catch (err) {
    throw new Error(`Could not parse Claude's response as JSON: ${(err as Error).message}`);
  }
  return parsed.questions ?? [];
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI generation is not configured: ANTHROPIC_API_KEY is missing on the server.");
  }
  return new Anthropic({ apiKey });
}

export const generateQuestions = createServerFn({ method: "POST" })
  .inputValidator((data: unknown): GenerateInput => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid request body");
    const v = data as Record<string, unknown>;
    const topic = typeof v.topic === "string" ? v.topic.trim() : "";
    const count = Number(v.count);
    const difficulty = v.difficulty as Difficulty;
    const language = typeof v.language === "string" ? v.language : "en";
    if (!topic) throw new Error("topic is required");
    if (!Number.isInteger(count) || count < 1 || count > 20)
      throw new Error("count must be an integer between 1 and 20");
    if (!["easy", "medium", "hard"].includes(difficulty))
      throw new Error("difficulty must be easy | medium | hard");
    return { topic, count, difficulty, language };
  })
  .handler(async ({ data }): Promise<DraftQuestion[]> => {
    const client = getClient();

    const userPrompt = [
      `Topic: ${data.topic}`,
      `Number of questions: ${data.count}`,
      `Difficulty: ${data.difficulty}`,
      `Language: ${data.language ?? "en"}`,
      "",
      `Question stems must be ≤ ${MAX_QUESTION_LENGTH} characters. Vary question style across the set.`,
    ].join("\n");

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text" || !textBlock.text) {
      throw new Error("Claude returned no content");
    }
    return normalizeRows(parseQuestions(textBlock.text), data.difficulty).slice(0, data.count);
  });

export const extractQuestionsFromImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown): ExtractInput => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid request body");
    const v = data as Record<string, unknown>;
    const imageBase64 = typeof v.imageBase64 === "string" ? v.imageBase64 : "";
    const mediaType = v.mediaType as ExtractInput["mediaType"];
    const hint = typeof v.hint === "string" ? v.hint : "";
    const difficulty = (v.difficulty ?? "medium") as Difficulty;
    if (!imageBase64) throw new Error("imageBase64 is required");
    if (!SUPPORTED_MEDIA_TYPES.includes(mediaType))
      throw new Error(`mediaType must be one of: ${SUPPORTED_MEDIA_TYPES.join(", ")}`);
    if (imageBase64.length > MAX_IMAGE_BYTES)
      throw new Error(`Image is too large (max ~${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB)`);
    if (!["easy", "medium", "hard"].includes(difficulty))
      throw new Error("difficulty must be easy | medium | hard");
    return { imageBase64, mediaType, hint, difficulty };
  })
  .handler(async ({ data }): Promise<DraftQuestion[]> => {
    const client = getClient();

    const userText = [
      "Extract every multiple-choice question visible in this image.",
      data.hint ? `Additional context from the user: ${data.hint}` : "",
      "Return them as drafts the teacher can review and edit.",
    ]
      .filter(Boolean)
      .join("\n");

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      system: SYSTEM_PROMPT_SCAN,
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
    return normalizeRows(parseQuestions(textBlock.text), data.difficulty ?? "medium");
  });
