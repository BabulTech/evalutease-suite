import type { SessionStatus } from "@/components/sessions/types";

export const PARTICIPANT_PAGE_SIZES = [10, 25, 50];
export const RESULT_PAGE_SIZE = 25;

export type SessionRow = {
  id: string;
  title: string;
  status: SessionStatus;
  default_time_per_question: number | null;
  access_code: string | null;
  is_open: boolean;
  scheduled_at: string | null;
  started_at: string | null;
  paused_at: string | null;
  pause_offset_seconds: number;
  category_id: string | null;
  subcategory_id: string | null;
  created_at: string;
  subject: string | null;
  topic: string | null;
  description: string | null;
  show_results_after_quiz: boolean;
};

export type Attendee = {
  id: string;
  name: string;
  email: string | null;
  rollNumber: string | null;
  seatNumber: string | null;
  completed: boolean;
  score: number;
  total: number;
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
  completedAt: string | null;
};

export type AttemptWithDetails = {
  id: string;
  participant_name: string | null;
  participant_email: string | null;
  participant_id: string | null;
  completed: boolean;
  completed_at: string | null;
  score: number;
  total_questions: number;
  quiz_answers: { id: string; is_correct: boolean | null }[] | null;
  participants: { metadata: unknown } | null;
};

export type AttemptLive = {
  id: string;
  participant_name: string | null;
  participant_email: string | null;
  participant_id: string | null;
  completed: boolean;
  completed_at: string | null;
  score: number;
  total_questions: number;
  metadata: unknown;
};

export type ProfileRow = {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  organization: string | null;
};

export type ParticipantStatusBroadcast = {
  status?: SessionStatus;
  started_at?: string | null;
  scheduled_at?: string | null;
  paused_at?: string | null;
  pause_offset_seconds?: number;
  is_open?: boolean;
  show_results_after_quiz?: boolean;
  force_end?: boolean;
};
