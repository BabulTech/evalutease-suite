import { recallAttempt } from "@/components/quiz/types";
import type { QuizPhase, SessionForJoin } from "@/components/quiz/types";

type SessionUpdate = Partial<SessionForJoin["session"]> & { access_code?: string | null };

export function routeForData(
  data: SessionForJoin,
  prev: QuizPhase,
  justJoinedAttempt?: string,
): QuizPhase {
  const session = data.session;
  const existingAttemptId =
    justJoinedAttempt ??
    (prev.kind === "lobby" || prev.kind === "quiz" || prev.kind === "completed"
      ? prev.attemptId
      : recallAttempt(session.id));

  if (session.status === "completed" || session.status === "expired") {
    if (existingAttemptId && prev.kind === "completed") return prev;
    if (existingAttemptId) {
      return {
        kind: "completed",
        data,
        attemptId: existingAttemptId,
        score: prev.kind === "completed" ? prev.score : 0,
        total: session.total_questions,
        speedBonus: prev.kind === "completed" ? prev.speedBonus : 0,
        hasPendingGrading: prev.kind === "completed" ? prev.hasPendingGrading : false,
      };
    }
    return { kind: "error", message: "This quiz session has already ended." };
  }

  if (session.status === "active" && session.started_at && session.total_duration_seconds) {
    const pauseOffset = session.pause_offset_seconds ?? 0;
    const elapsed =
      Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000) - pauseOffset;
    if (elapsed >= session.total_duration_seconds) {
      return { kind: "error", message: "This quiz has already ended. You joined too late." };
    }
  }

  if (!existingAttemptId) {
    return { kind: "register", data };
  }

  if (session.status === "scheduled") {
    return { kind: "lobby", data, attemptId: existingAttemptId };
  }
  if (session.status === "active") {
    if (!session.started_at) {
      return { kind: "lobby", data, attemptId: existingAttemptId };
    }
    return { kind: "quiz", data, attemptId: existingAttemptId };
  }
  return { kind: "lobby", data, attemptId: existingAttemptId };
}

export function applySessionUpdate(prev: QuizPhase, update: SessionUpdate): QuizPhase {
  if (
    prev.kind !== "register" &&
    prev.kind !== "lobby" &&
    prev.kind !== "quiz" &&
    prev.kind !== "completed"
  ) {
    return prev;
  }
  if (prev.kind === "completed" && update.show_results_after_quiz !== undefined) {
    return {
      ...prev,
      data: {
        ...prev.data,
        session: { ...prev.data.session, show_results_after_quiz: update.show_results_after_quiz },
      },
    };
  }
  const nextData: SessionForJoin = {
    ...prev.data,
    session: {
      ...prev.data.session,
      ...pickSessionUpdate(update),
    },
  };
  return routeForData(nextData, prev);
}

function pickSessionUpdate(update: SessionUpdate): Partial<SessionForJoin["session"]> {
  return {
    ...(update.id !== undefined ? { id: update.id } : {}),
    ...(update.title !== undefined ? { title: update.title } : {}),
    ...(update.status !== undefined ? { status: update.status } : {}),
    ...(update.started_at !== undefined ? { started_at: update.started_at } : {}),
    ...(update.scheduled_at !== undefined ? { scheduled_at: update.scheduled_at } : {}),
    ...(update.paused_at !== undefined ? { paused_at: update.paused_at } : {}),
    ...(update.pause_offset_seconds !== undefined
      ? { pause_offset_seconds: update.pause_offset_seconds }
      : {}),
    ...(update.default_time_per_question !== undefined
      ? { default_time_per_question: update.default_time_per_question }
      : {}),
    ...(update.access_code !== undefined && update.access_code !== null
      ? { access_code: update.access_code }
      : {}),
    ...(update.is_open !== undefined ? { is_open: update.is_open } : {}),
    ...(update.total_questions !== undefined ? { total_questions: update.total_questions } : {}),
    ...(update.show_results_after_quiz !== undefined
      ? { show_results_after_quiz: update.show_results_after_quiz }
      : {}),
  };
}

export function mapJoinError(code: string): string {
  switch (code) {
    case "not_found":
      return "That quiz PIN isn't recognised.";
    case "session_closed":
      return "This session has already finished.";
    case "not_invited":
      return "Sorry, your details are not on the invited roster. Check with the host.";
    case "identifier_required":
      return "This private quiz requires your email, mobile, or roll number to verify identity.";
    case "email_required":
      return "This private quiz requires the same email your teacher added to the roster.";
    case "session_not_active":
      return "The quiz has not started yet. Please wait for the host to begin.";
    case "name_required":
      return "Name is required to join.";
    default:
      return "Could not join the session.";
  }
}
