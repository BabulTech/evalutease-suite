export const HISTORY_PAGE_SIZE = 25;

export const QUIZ_TYPE_LABELS: Record<string, string> = {
  mcq: "MCQ",
  true_false: "True / False",
  mixed: "Mixed",
  short_answer: "Short Answer",
  descriptive: "Descriptive",
};

export type SessionRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  category_id: string | null;
  subcategory_id: string | null;
  default_time_per_question: number | null;
  subject: string | null;
  topic: string | null;
  description: string | null;
};

export type AttemptRow = {
  id: string;
  session_id: string;
  participant_id: string | null;
  participant_name: string | null;
  participant_email: string | null;
  score: number;
  total_questions: number;
  completed: boolean;
  completed_at: string | null;
  participants: { metadata: unknown } | null;
};

export type SessionWithStats = SessionRow & {
  categoryName: string;
  subcategoryName: string;
  attempts: AttemptRow[];
  avgPercent: number;
  avgScore: number;
};

export type ProfileRow = {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  organization: string | null;
};
