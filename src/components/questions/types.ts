// ============================================================
// Question type system (Phase 1 — multi-type plumbing).
// Supported: mcq | true_false | short_answer | long_answer.
// Existing MCQ flow stays the default and is unchanged.
// ============================================================

export const MAX_QUESTION_LENGTH = 250;
export const MAX_OPTION_LENGTH = 150;
export const OPTION_COUNT = 4;
export const DEFAULT_TIME_SECONDS = 10;

export const MAX_SHORT_ANSWER_LENGTH = 200;
export const MAX_LONG_ANSWER_LENGTH = 4000;

export type Difficulty = "easy" | "medium" | "hard";
export type QuestionSource = "manual" | "ai" | "ocr" | "import";
export type QuestionType = "mcq" | "true_false" | "short_answer" | "long_answer";

export const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  { value: "mcq",          label: "Multiple Choice",  description: "Pick one correct option" },
  { value: "true_false",   label: "True / False",     description: "Statement is true or false" },
  { value: "short_answer", label: "Short Answer",     description: "Brief written response" },
  { value: "long_answer",  label: "Long Answer",      description: "Essay-style response" },
];

export type Category = {
  id: string;
  name: string;
  subject: string | null;
  created_at: string;
};

// ─── Stored question (DB shape) ─────────────────────────────────
// New fields (type/acceptable_answers/...) are optional so SELECTs that
// were written before Phase 1 still type-check. Default to MCQ semantics.
export type Question = {
  id: string;
  category_id: string | null;
  subcategory_id: string | null;
  type?: QuestionType;
  text: string;
  options: string[];
  correct_answer: string;
  acceptable_answers?: string[] | null;
  model_answer?: string | null;
  rubric?: string | null;
  max_points?: number;
  requires_manual_grading?: boolean;
  difficulty: Difficulty;
  explanation: string | null;
  source: QuestionSource;
  time_seconds: number;
  created_at: string;
};

// ─── Draft (editor / AI / scan / import shape) ──────────────────
type BaseDraft = {
  text: string;
  difficulty: Difficulty;
  explanation: string;
  timeSeconds: number;
  maxPoints: number;
};

export type McqDraft = BaseDraft & {
  type: "mcq";
  options: string[];     // 2-6 options (default 4)
  correctIndex: number;
};

export type TrueFalseDraft = BaseDraft & {
  type: "true_false";
  correctValue: boolean;
};

export type ShortAnswerDraft = BaseDraft & {
  type: "short_answer";
  acceptableAnswers: string[];      // case-insensitive auto-grade
  requiresManualGrading: boolean;   // host wants to review even if accepted answers exist
};

export type LongAnswerDraft = BaseDraft & {
  type: "long_answer";
  modelAnswer: string;
  rubric: string;
};

export type DraftQuestion = McqDraft | TrueFalseDraft | ShortAnswerDraft | LongAnswerDraft;

// Overloads so callers get the precise subtype back instead of the wide union.
export function emptyDraft(type: "mcq", difficulty?: Difficulty): McqDraft;
export function emptyDraft(type: "true_false", difficulty?: Difficulty): TrueFalseDraft;
export function emptyDraft(type: "short_answer", difficulty?: Difficulty): ShortAnswerDraft;
export function emptyDraft(type: "long_answer", difficulty?: Difficulty): LongAnswerDraft;
export function emptyDraft(type?: QuestionType, difficulty?: Difficulty): DraftQuestion;
export function emptyDraft(
  type: QuestionType = "mcq",
  difficulty: Difficulty = "medium",
): DraftQuestion {
  switch (type) {
    case "mcq":
      return {
        type: "mcq",
        text: "",
        options: ["", "", "", ""],
        correctIndex: 0,
        difficulty,
        explanation: "",
        timeSeconds: DEFAULT_TIME_SECONDS,
        maxPoints: 1,
      };
    case "true_false":
      return {
        type: "true_false",
        text: "",
        correctValue: true,
        difficulty,
        explanation: "",
        timeSeconds: DEFAULT_TIME_SECONDS,
        maxPoints: 1,
      };
    case "short_answer":
      return {
        type: "short_answer",
        text: "",
        acceptableAnswers: [""],
        requiresManualGrading: false,
        difficulty,
        explanation: "",
        timeSeconds: 30,
        maxPoints: 1,
      };
    case "long_answer":
      return {
        type: "long_answer",
        text: "",
        modelAnswer: "",
        rubric: "",
        difficulty,
        explanation: "",
        timeSeconds: 300,
        maxPoints: 5,
      };
  }
}

export type DraftValidation = { ok: true } | { ok: false; reason: string };

export function validateDraft(d: DraftQuestion): DraftValidation {
  const text = d.text.trim();
  if (!text) return { ok: false, reason: "Question text is required" };
  if (text.length > MAX_QUESTION_LENGTH)
    return { ok: false, reason: `Question must be ≤ ${MAX_QUESTION_LENGTH} characters` };
  if (!Number.isFinite(d.timeSeconds) || d.timeSeconds < 5 || d.timeSeconds > 3600)
    return { ok: false, reason: "Time per question must be between 5s and 1h" };
  if (!Number.isFinite(d.maxPoints) || d.maxPoints < 1 || d.maxPoints > 100)
    return { ok: false, reason: "Max points must be between 1 and 100" };

  switch (d.type) {
    case "mcq": {
      if (d.options.length < 2 || d.options.length > 6)
        return { ok: false, reason: "MCQ must have 2-6 options" };
      for (let i = 0; i < d.options.length; i++) {
        if (!d.options[i].trim()) return { ok: false, reason: `Option ${labelFor(i)} is empty` };
      }
      if (d.correctIndex < 0 || d.correctIndex >= d.options.length)
        return { ok: false, reason: "Pick a correct answer" };
      return { ok: true };
    }
    case "true_false": {
      // correctValue is boolean — always valid
      return { ok: true };
    }
    case "short_answer": {
      if (!d.requiresManualGrading) {
        const valid = d.acceptableAnswers.map((a) => a.trim()).filter(Boolean);
        if (valid.length === 0)
          return { ok: false, reason: "Add at least one accepted answer, or enable manual grading" };
      }
      return { ok: true };
    }
    case "long_answer": {
      // Model answer and rubric are optional — host can grade purely from the question text.
      return { ok: true };
    }
  }
}

export function labelFor(i: number) {
  return String.fromCharCode(65 + i);
}

// Type guards — let consumers narrow the discriminated union.
export const isMcqDraft = (d: DraftQuestion): d is McqDraft => d.type === "mcq";
export const isTrueFalseDraft = (d: DraftQuestion): d is TrueFalseDraft => d.type === "true_false";
export const isShortAnswerDraft = (d: DraftQuestion): d is ShortAnswerDraft => d.type === "short_answer";
export const isLongAnswerDraft = (d: DraftQuestion): d is LongAnswerDraft => d.type === "long_answer";

// Canonical "what answer string goes in DB.correct_answer" for each draft type.
// Used when saving questions so legacy code that reads correct_answer keeps working.
export function canonicalCorrectAnswer(d: DraftQuestion): string {
  switch (d.type) {
    case "mcq":          return d.options[d.correctIndex] ?? "";
    case "true_false":   return d.correctValue ? "true" : "false";
    case "short_answer": return d.acceptableAnswers.find((a) => a.trim()) ?? "";
    case "long_answer":  return d.modelAnswer;
  }
}
