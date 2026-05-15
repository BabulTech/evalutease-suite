import type { RegistrationFieldKey, RegistrationFields } from "@/components/settings/host-settings";

export type SessionPublic = {
  id: string;
  title: string;
  status: "draft" | "scheduled" | "active" | "completed" | "expired";
  started_at: string | null;
  scheduled_at: string | null;
  paused_at: string | null;
  pause_offset_seconds: number;
  default_time_per_question: number;
  access_code: string;
  is_open: boolean;
  total_questions: number;
};

export type QuizQuestionType = "mcq" | "true_false" | "short_answer" | "long_answer";

export type QuizQuestion = {
  id: string;
  text: string;
  type: QuizQuestionType;
  options: string[];
  position: number;
  time_seconds: number;
};

export type SessionForJoin = {
  session: SessionPublic;
  registration_fields: RegistrationFields;
  questions: QuizQuestion[];
};

export type RegistrationValues = Partial<Record<RegistrationFieldKey, string>>;

export type QuizPhase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "register"; data: SessionForJoin }
  | { kind: "lobby"; data: SessionForJoin; attemptId: string }
  | { kind: "quiz"; data: SessionForJoin; attemptId: string }
  | {
      kind: "completed";
      data: SessionForJoin;
      attemptId: string;
      score: number;
      total: number;
      speedBonus: number;
    };

export type QuizClock = {
  index: number;
  secondsLeft: number;
  done: boolean;
};

export function computeClock(
  startedAtIso: string | null,
  questions: QuizQuestion[],
  defaultTime: number,
  now: number,
  pausedAtIso: string | null = null,
  pauseOffsetSec = 0,
): QuizClock {
  if (!startedAtIso) return { index: -1, secondsLeft: 0, done: false };
  const started = new Date(startedAtIso).getTime();
  if (Number.isNaN(started)) return { index: -1, secondsLeft: 0, done: false };
  if (questions.length === 0) return { index: 0, secondsLeft: 0, done: true };

  // While paused, freeze the clock at paused_at — otherwise use now().
  // The cumulative pause_offset_seconds from previous pause/resume cycles is
  // always subtracted from elapsed.
  const reference = pausedAtIso ? new Date(pausedAtIso).getTime() : now;
  let elapsed = Math.max(
    0,
    Math.floor((reference - started) / 1000) - Math.max(0, pauseOffsetSec),
  );
  for (let i = 0; i < questions.length; i++) {
    const dur = questions[i].time_seconds || defaultTime;
    if (elapsed < dur) {
      return { index: i, secondsLeft: dur - elapsed, done: false };
    }
    elapsed -= dur;
  }
  return { index: questions.length, secondsLeft: 0, done: true };
}

const STORAGE_PREFIX = "bq.attempt.";

export function rememberAttempt(sessionId: string, attemptId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_PREFIX + sessionId, attemptId);
  } catch {
    // ignore
  }
}

export function recallAttempt(sessionId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_PREFIX + sessionId);
  } catch {
    return null;
  }
}

export function forgetAttempt(sessionId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_PREFIX + sessionId);
  } catch {
    // ignore
  }
}
