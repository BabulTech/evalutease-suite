import { supabase } from "@/integrations/supabase/client";
import type { QuizReportAttempt } from "@/lib/quiz-reports";
import type { Attendee, AttemptLive, ParticipantStatusBroadcast, ProfileRow } from "./types";

export function toReportAttempts(
  attendees: Attendee[],
  totalMaxPoints?: number | null,
): QuizReportAttempt[] {
  return attendees.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    rollNumber: a.rollNumber,
    seatNumber: a.seatNumber,
    score: a.score,
    totalQuestions: a.total,
    totalMaxPoints: totalMaxPoints ?? null,
    attemptedQuestions: a.attempted,
    correctAnswers: a.correct,
    wrongAnswers: a.wrong,
    unattemptedQuestions: a.unattempted,
    completed: a.completed,
    completedAt: a.completedAt,
  }));
}

export function mapLiveAttempt(a: AttemptLive): Attendee {
  const meta =
    a.metadata && typeof a.metadata === "object" ? (a.metadata as Record<string, unknown>) : {};
  const attempted = a.completed ? a.total_questions : 0;
  return {
    id: a.id,
    name: a.participant_name ?? "Anonymous",
    email: a.participant_email,
    rollNumber: stringMeta(meta.roll_number),
    seatNumber: stringMeta(meta.seat_number),
    completed: a.completed,
    score: a.score,
    total: a.total_questions,
    attempted,
    correct: a.completed ? a.score : 0,
    wrong: 0,
    unattempted: Math.max(0, a.total_questions - attempted),
    completedAt: a.completed_at,
  };
}

export function sortAttendees(attendees: Attendee[]) {
  return attendees.slice().sort((a, b) => {
    if (a.completed !== b.completed) return Number(b.completed) - Number(a.completed);
    return b.score - a.score || b.total - a.total || a.name.localeCompare(b.name);
  });
}

export function getTeacherName(profile: ProfileRow | null, email?: string | null) {
  const full = profile?.full_name?.trim();
  if (full) return full;
  const joined = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  return joined || email?.split("@")[0] || "Teacher";
}

export function stringMeta(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function broadcastParticipantStatus(
  accessCode: string | null,
  payload: ParticipantStatusBroadcast,
) {
  if (!accessCode) return;
  const channel = supabase.channel(`quiz-status-${accessCode}`, {
    config: { broadcast: { self: false } },
  });
  try {
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, 1200);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          window.clearTimeout(timeout);
          resolve();
        }
      });
    });
    await channel.send({
      type: "broadcast",
      event: "status",
      payload: { access_code: accessCode, ...payload },
    });
  } finally {
    void supabase.removeChannel(channel);
  }
}
