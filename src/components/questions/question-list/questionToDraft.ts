import type { DraftQuestion, Question } from "../types";

export function questionToDraft(q: Question): DraftQuestion {
  const base = {
    text: q.text,
    difficulty: q.difficulty,
    explanation: q.explanation ?? "",
    timeSeconds: q.time_seconds,
    maxPoints: q.max_points ?? 1,
  };

  const inferredType: NonNullable<Question["type"]> =
    q.type ??
    (q.model_answer || q.rubric
      ? "long_answer"
      : q.acceptable_answers && q.acceptable_answers.length > 0
        ? "short_answer"
        : q.options.length === 0 && (q.correct_answer === "true" || q.correct_answer === "false")
          ? "true_false"
          : q.options.length === 0
            ? "long_answer"
            : "mcq");

  if (inferredType === "true_false") {
    return { ...base, type: "true_false", correctValue: q.correct_answer === "true" };
  }

  if (inferredType === "short_answer") {
    return {
      ...base,
      type: "short_answer",
      acceptableAnswers: q.acceptable_answers?.length
        ? q.acceptable_answers
        : q.correct_answer
          ? [q.correct_answer]
          : [""],
      requiresManualGrading: q.requires_manual_grading ?? false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gradingMode: (q as any).grading_mode ?? "auto",
    };
  }

  if (inferredType === "long_answer") {
    return {
      ...base,
      type: "long_answer",
      modelAnswer: q.model_answer ?? "",
      rubric: q.rubric ?? "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gradingMode: ((q as any).grading_mode ?? "manual") as "ai" | "manual",
    };
  }

  const options = [...q.options];
  while (options.length < 4) options.push("");
  const correctIndex = options.findIndex((o) => o === q.correct_answer);
  return {
    ...base,
    type: "mcq",
    options: options.slice(0, 4),
    correctIndex: correctIndex === -1 ? 0 : correctIndex,
  };
}
