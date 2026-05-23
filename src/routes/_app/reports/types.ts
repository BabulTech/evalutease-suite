export const REPORT_PAGE_SIZE = 25;

export const DATE_RANGE_KEYS: Record<DateRange, string> = {
  all: "rep.allTime",
  "7d": "rep.last7d",
  "30d": "rep.last30d",
  "90d": "rep.last90d",
};

export const SORT_KEYS: Record<SortOption, string> = {
  rank: "rep.positionBestFirst",
  percentDesc: "rep.scoreHighLow",
  percentAsc: "rep.scoreLowHigh",
  name: "rep.nameAZ",
  fastest: "rep.fastest",
  recent: "rep.mostRecent",
};

export type SessionRow = {
  id: string;
  title: string;
  created_at: string;
  category_id: string | null;
  subcategory_id: string | null;
  subject: string | null;
  topic: string | null;
  description: string | null;
};

export type AttemptRow = {
  id: string;
  participant_name: string | null;
  participant_email: string | null;
  score: number;
  total_questions: number;
  completed: boolean;
  started_at: string | null;
  completed_at: string | null;
  participants: { metadata: unknown } | null;
};

export type ReportSession = SessionRow & {
  categoryName: string;
  subcategoryName: string;
};

export type ProfileRow = {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  organization: string | null;
};

export type ReportMode = "quiz" | "student";
export type StudentMode = "attempts" | "students";
export type DateRange = "all" | "7d" | "30d" | "90d";
export type StatusFilter = "all" | "completed" | "pending";
export type SortOption = "rank" | "percentDesc" | "percentAsc" | "name" | "fastest" | "recent";

export type StudentAttemptRow = import("@/lib/quiz-reports").QuizReportRow & {
  sessionId: string;
  sessionTitle: string;
  sessionCategory: string;
  sessionCreatedAt: string;
};

export type StudentSummaryRow = {
  key: string;
  name: string;
  email: string | null;
  attempts: number;
  submitted: number;
  avgPercent: number;
  bestPercent: number;
  worstPercent: number;
  totalPoints: number;
  lastAttemptAt: string | null;
};

export type AttemptAnswer = {
  id: string;
  attempt_id: string;
  question_id: string;
  question_text: string;
  question_type: string;
  answer: string | null;
  points_awarded: number | null;
  max_points: number;
  is_correct: boolean | null;
  graded_at: string | null;
  model_answer: string | null;
  rubric: string | null;
};
