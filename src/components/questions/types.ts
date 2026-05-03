export const MAX_QUESTION_LENGTH = 250;
export const MAX_OPTION_LENGTH = 150;
export const OPTION_COUNT = 4;
export const DEFAULT_TIME_SECONDS = 10;

export type Difficulty = "easy" | "medium" | "hard";
export type QuestionSource = "manual" | "ai" | "ocr" | "import";

export type Category = {
  id: string;
  name: string;
  subject: string | null;
  created_at: string;
};

export type Question = {
  id: string;
  category_id: string | null;
  subcategory_id: string | null;
  text: string;
  options: string[];
  correct_answer: string;
  difficulty: Difficulty;
  explanation: string | null;
  source: QuestionSource;
  time_seconds: number;
  created_at: string;
};

export type DraftQuestion = {
  text: string;
  options: string[];
  correctIndex: number;
  difficulty: Difficulty;
  explanation: string;
  timeSeconds: number;
};

export function emptyDraft(difficulty: Difficulty = "medium"): DraftQuestion {
  return {
    text: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    difficulty,
    explanation: "",
    timeSeconds: DEFAULT_TIME_SECONDS,
  };
}

export type DraftValidation = { ok: true } | { ok: false; reason: string };

export function validateDraft(d: DraftQuestion): DraftValidation {
  const text = d.text.trim();
  if (!text) return { ok: false, reason: "Question text is required" };
  if (text.length > MAX_QUESTION_LENGTH)
    return { ok: false, reason: `Question must be ≤ ${MAX_QUESTION_LENGTH} characters` };
  if (d.options.length !== OPTION_COUNT)
    return { ok: false, reason: `Exactly ${OPTION_COUNT} options required` };
  for (let i = 0; i < d.options.length; i++) {
    if (!d.options[i].trim()) return { ok: false, reason: `Option ${labelFor(i)} is empty` };
  }
  if (d.correctIndex < 0 || d.correctIndex >= OPTION_COUNT)
    return { ok: false, reason: "Pick a correct answer" };
  if (!Number.isFinite(d.timeSeconds) || d.timeSeconds < 5 || d.timeSeconds > 3600)
    return { ok: false, reason: "Time per question must be between 5s and 1h" };
  return { ok: true };
}

export function labelFor(i: number) {
  return String.fromCharCode(65 + i);
}
