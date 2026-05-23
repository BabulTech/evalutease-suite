import type { Difficulty, QuestionType } from "../types";

export type GenerateKind = QuestionType | "mix";

export type GenerateInput = {
  topic: string;
  count: number;
  difficulty: Difficulty;
  language?: string;
  kind?: GenerateKind;
  _token: string;
};

export type ExtractInput = {
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  hint?: string;
  difficulty?: Difficulty;
  _token: string;
};

export type RawAnyQuestion = {
  type?: string;
  text?: string;
  options?: string[];
  correctIndex?: number;
  correctValue?: boolean;
  acceptableAnswers?: string[];
  modelAnswer?: string;
  rubric?: string;
  explanation?: string;
};

export const SUPPORTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
export const MAX_TOPIC_LENGTH = 200;
export const MAX_HINT_LENGTH = 300;
export const AI_MODEL = "claude-haiku-4-5-20251001";
