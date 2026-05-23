export type QuestionType = "short_answer" | "long_answer";
export type GradingMode = "auto" | "ai" | "manual";
export type GradeVerdict = "correct" | "partial" | "wrong";
export type PageMode = "select" | "manual" | "ai-setup" | "ai-running" | "ai-review";
export type AiRowState = "idle" | "criteria" | "running" | "review";

export type GradeAnswer = {
  id: string;
  answer_text: string | null;
  points_awarded: number | null;
  graded_at: string | null;
  grader_comment: string | null;
  question_id: string;
  question_text: string;
  question_type: QuestionType;
  grading_mode: GradingMode;
  max_points: number;
  model_answer: string | null;
  rubric: string | null;
  participant_name: string | null;
  attempt_id: string;
};

export type QuestionGroup = {
  question_id: string;
  question_text: string;
  question_type: QuestionType;
  max_points: number;
  model_answer: string | null;
  rubric: string | null;
  answers: GradeAnswer[];
};

export type AiCriteria = {
  concepts: boolean;
  grammar: boolean;
  spelling: boolean;
  relevance: boolean;
  custom: string;
};

export type AiResult = { points: number; comment: string; reasoning: string };
export type AiReviewItem = { answer: GradeAnswer; result: AiResult; adjustedPoints: number };
export type RowGrade = {
  verdict: GradeVerdict | null;
  customPoints: number | null;
  comment: string;
  showComment: boolean;
};

// Strip prompt-injection attempts and limit length
export function sanitizeForAi(text: string, maxLen = 2000): string {
  return (
    text
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .replace(/ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/gi, "[removed]")
      .replace(/you\s+are\s+now\s+(a|an)\s+/gi, "[removed] ")
      .replace(/disregard\s+(all\s+)?(previous|prior)\s+/gi, "[removed] ")
      .replace(/system\s*prompt/gi, "[removed]")
      .replace(/jailbreak/gi, "[removed]")
      .slice(0, maxLen)
      .trim()
  );
}

export function buildCriteriaNote(c: AiCriteria) {
  return (
    [
      c.concepts && "concepts and key ideas",
      c.relevance && "relevance to the question",
      c.grammar && "grammar",
      c.spelling && "spelling",
      c.custom.trim() || "",
    ]
      .filter(Boolean)
      .join(", ") || "overall quality"
  );
}

export function verdictColor(v: GradeVerdict) {
  if (v === "correct") return "border-success bg-success/10 text-success";
  if (v === "partial") return "border-warning bg-warning/10 text-warning";
  return "border-destructive bg-destructive/10 text-destructive";
}

export function verdictPoints(v: GradeVerdict, maxPoints: number): number {
  if (v === "correct") return maxPoints;
  if (v === "partial") return Math.max(1, Math.floor(maxPoints / 2));
  return 0;
}
