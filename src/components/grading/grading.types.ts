export type GradeInput = {
  questionText: string;
  questionType: "short_answer" | "long_answer";
  modelAnswer: string;
  rubric: string;
  studentAnswer: string;
  maxPoints: number;
};

export type GradeResult = {
  points: number;
  comment: string;
  reasoning: string;
};

export type BatchQuestion = {
  id: string;
  questionText: string;
  questionType: "short_answer" | "long_answer";
  studentAnswer: string;
  maxPoints: number;
  modelAnswer?: string;
  rubric?: string;
};

export type BatchResult = {
  id: string;
  points: number;
  comment: string;
  reasoning: string;
};
