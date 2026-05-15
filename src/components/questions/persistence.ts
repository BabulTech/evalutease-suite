// Converts a DraftQuestion (any type) into the row shape we INSERT into
// public.questions. Keeps the legacy columns (options/correct_answer) filled
// for backward compatibility while populating the new type-specific columns.

import { canonicalCorrectAnswer, type DraftQuestion, type QuestionSource } from "./types";

export type QuestionRow = {
  owner_id: string;
  category_id: string;
  subcategory_id: string;
  text: string;
  type: DraftQuestion["type"];
  difficulty: DraftQuestion["difficulty"];
  options: string[];
  correct_answer: string;
  acceptable_answers: string[] | null;
  model_answer: string | null;
  rubric: string | null;
  max_points: number;
  requires_manual_grading: boolean;
  explanation: string | null;
  source: QuestionSource;
  time_seconds: number;
};

export function draftToRow(
  d: DraftQuestion,
  ctx: { ownerId: string; categoryId: string; subcategoryId: string; source: QuestionSource },
): QuestionRow {
  const base = {
    owner_id: ctx.ownerId,
    category_id: ctx.categoryId,
    subcategory_id: ctx.subcategoryId,
    text: d.text.trim(),
    type: d.type,
    difficulty: d.difficulty,
    options: [] as string[],
    correct_answer: canonicalCorrectAnswer(d),
    acceptable_answers: null as string[] | null,
    model_answer: null as string | null,
    rubric: null as string | null,
    max_points: d.maxPoints,
    requires_manual_grading: false,
    explanation: d.explanation.trim() || null,
    source: ctx.source,
    time_seconds: d.timeSeconds,
  };

  switch (d.type) {
    case "mcq":
      base.options = d.options.map((o) => o.trim());
      break;
    case "true_false":
      // Store the two answers as options so legacy code still renders them.
      base.options = ["true", "false"];
      break;
    case "short_answer":
      base.acceptable_answers = d.acceptableAnswers.map((a) => a.trim()).filter(Boolean);
      base.requires_manual_grading = d.requiresManualGrading;
      break;
    case "long_answer":
      base.model_answer = d.modelAnswer.trim() || null;
      base.rubric = d.rubric.trim() || null;
      base.requires_manual_grading = true; // long answers are always manually (or AI-) graded
      break;
  }

  return base;
}
