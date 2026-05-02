export type SessionStatus = "draft" | "scheduled" | "active" | "completed" | "expired";

export type Category = { id: string; name: string };
export type QuestionLite = {
  id: string;
  text: string;
  category_id: string | null;
  difficulty: "easy" | "medium" | "hard";
};
export type ParticipantLite = {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
};

export type Session = {
  id: string;
  title: string;
  category_id: string | null;
  category_name: string | null;
  status: SessionStatus;
  default_time_per_question: number;
  access_code: string | null;
  is_open: boolean;
  scheduled_at: string | null;
  created_at: string;
  question_count: number;
  participant_count: number;
  attempts: AttemptStats;
};

export type AttemptStats = {
  joined: number;
  waiting: number;
  submitted: number;
  avgPercent: number;
  topThree: TopThreeEntry[];
};

export type TopThreeEntry = {
  name: string;
  score: number;
  total: number;
};

export type SaveMode = "now" | "schedule";

export type SessionDraft = {
  title: string;
  categoryId: string | null;
  timePerQuestionSec: number;
  questionIds: string[];
  participantIds: string[];
  saveMode: SaveMode;
  scheduledAtLocal: string;
};

export const TIME_OPTIONS: { value: number; label: string }[] = [
  { value: 15, label: "15 seconds" },
  { value: 30, label: "30 seconds" },
  { value: 45, label: "45 seconds" },
  { value: 60, label: "1 minute" },
  { value: 90, label: "1.5 minutes" },
  { value: 120, label: "2 minutes" },
  { value: 180, label: "3 minutes" },
  { value: 300, label: "5 minutes" },
  { value: 600, label: "10 minutes" },
];

export function emptyDraft(): SessionDraft {
  return {
    title: "",
    categoryId: null,
    timePerQuestionSec: 60,
    questionIds: [],
    participantIds: [],
    saveMode: "now",
    scheduledAtLocal: "",
  };
}

export type DraftValidation = { ok: true } | { ok: false; reason: string };

export function validateDraft(d: SessionDraft): DraftValidation {
  const title = d.title.trim();
  if (!title) return { ok: false, reason: "Title is required" };
  if (title.length > 200) return { ok: false, reason: "Title must be ≤ 200 characters" };
  if (!d.categoryId) return { ok: false, reason: "Pick a category" };
  if (d.questionIds.length === 0) return { ok: false, reason: "Select at least one question" };
  if (d.timePerQuestionSec < 5 || d.timePerQuestionSec > 3600)
    return { ok: false, reason: "Time per question must be between 5s and 1h" };
  if (d.saveMode === "schedule") {
    if (!d.scheduledAtLocal)
      return { ok: false, reason: "Pick a date and time to schedule the session" };
    const ts = new Date(d.scheduledAtLocal);
    if (Number.isNaN(ts.getTime())) return { ok: false, reason: "That schedule time is invalid" };
    if (ts.getTime() < Date.now() - 60_000)
      return { ok: false, reason: "Schedule must be in the future" };
  }
  return { ok: true };
}

export function generateAccessCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function statusBadge(s: Session): { label: string; className: string } {
  if (s.status === "active") return { label: "Live", className: "bg-success/15 text-success" };
  if (s.status === "completed")
    return { label: "Completed", className: "bg-muted text-muted-foreground" };
  if (s.status === "expired")
    return { label: "Expired", className: "bg-destructive/15 text-destructive" };
  if (s.status === "scheduled" && s.scheduled_at)
    return { label: "Scheduled", className: "bg-primary/15 text-primary" };
  return { label: "Pending", className: "bg-warning/15 text-warning" };
}

export function formatTimePerQuestion(seconds: number): string {
  if (seconds < 60) return `${seconds}s / question`;
  const mins = seconds / 60;
  if (Number.isInteger(mins)) return `${mins} min${mins === 1 ? "" : "s"} / question`;
  return `${mins.toFixed(1)} mins / question`;
}

export function emptyAttemptStats(): AttemptStats {
  return { joined: 0, waiting: 0, submitted: 0, avgPercent: 0, topThree: [] };
}
