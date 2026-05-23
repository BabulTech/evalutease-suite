import {
  emptyDraft,
  MAX_QUESTION_LENGTH,
  type Difficulty,
  type DraftQuestion,
  type McqDraft,
  type TrueFalseDraft,
  type ShortAnswerDraft,
  type LongAnswerDraft,
} from "../types";
import type { RawAnyQuestion } from "./types";

export function normalizeMcq(q: RawAnyQuestion, difficulty: Difficulty): McqDraft {
  const draft = emptyDraft("mcq", difficulty);
  draft.text = String(q.text ?? "").slice(0, MAX_QUESTION_LENGTH);
  const opts = Array.isArray(q.options) ? q.options.slice(0, 4) : [];
  while (opts.length < 4) opts.push("");
  draft.options = opts.map((o) => String(o ?? ""));
  draft.correctIndex =
    Number.isInteger(q.correctIndex) && q.correctIndex! >= 0 && q.correctIndex! < 4
      ? (q.correctIndex as number)
      : 0;
  draft.explanation = String(q.explanation ?? "");
  return draft;
}

export function normalizeTrueFalse(q: RawAnyQuestion, difficulty: Difficulty): TrueFalseDraft {
  const draft = emptyDraft("true_false", difficulty);
  draft.text = String(q.text ?? "").slice(0, MAX_QUESTION_LENGTH);
  draft.correctValue = typeof q.correctValue === "boolean" ? q.correctValue : true;
  draft.explanation = String(q.explanation ?? "");
  return draft;
}

export function normalizeShortAnswer(q: RawAnyQuestion, difficulty: Difficulty): ShortAnswerDraft {
  const draft = emptyDraft("short_answer", difficulty);
  draft.text = String(q.text ?? "").slice(0, MAX_QUESTION_LENGTH);
  const raw = Array.isArray(q.acceptableAnswers) ? q.acceptableAnswers : [];
  const cleaned = raw
    .flatMap((a) => {
      const t = String(a ?? "").trim();
      return t ? [t] : [];
    })
    .slice(0, 6);
  draft.acceptableAnswers = cleaned.length > 0 ? cleaned : [""];
  draft.requiresManualGrading = false;
  draft.explanation = String(q.explanation ?? "");
  return draft;
}

export function normalizeLongAnswer(q: RawAnyQuestion, difficulty: Difficulty): LongAnswerDraft {
  const draft = emptyDraft("long_answer", difficulty);
  draft.text = String(q.text ?? "").slice(0, MAX_QUESTION_LENGTH);
  draft.modelAnswer = String(q.modelAnswer ?? "");
  draft.rubric = String(q.rubric ?? "");
  draft.explanation = String(q.explanation ?? "");
  return draft;
}

export function normalizeRows(rows: RawAnyQuestion[], difficulty: Difficulty): DraftQuestion[] {
  return rows.map((q): DraftQuestion => {
    if (q.type === "true_false") return normalizeTrueFalse(q, difficulty);
    if (q.type === "short_answer") return normalizeShortAnswer(q, difficulty);
    if (q.type === "long_answer") return normalizeLongAnswer(q, difficulty);
    return normalizeMcq(q, difficulty);
  });
}

export function parseQuestions(text: string): RawAnyQuestion[] {
  let parsed: { questions?: RawAnyQuestion[] };
  try {
    parsed = JSON.parse(text) as { questions?: RawAnyQuestion[] };
  } catch (err) {
    throw new Error(`Could not parse Claude's response as JSON: ${(err as Error).message}`);
  }
  return parsed.questions ?? [];
}
