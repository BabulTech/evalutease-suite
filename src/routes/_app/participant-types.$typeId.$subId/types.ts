import type { Participant, ParticipantMeta } from "@/components/participants/types";

export type SubRow = { id: string; type_id: string; name: string };
export type TypeRow = { id: string; name: string };

export type ParticipantRow = {
  id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  metadata: unknown;
  subtype_id: string | null;
  created_at: string;
};

export type ParticipantStats = {
  totalAttempts: number;
  completedAttempts: number;
  totalCorrect: number;
  totalWrong: number;
  totalUnattempted: number;
  avgScore: number;
  highestScore: number;
  lowestScore: number;
  lastQuizAt: string | null;
  recentAttempts: { title: string; score: number; total: number; pct: number; date: string }[];
};

export function rowToParticipant(row: ParticipantRow): Participant {
  const meta =
    row.metadata && typeof row.metadata === "object" ? (row.metadata as ParticipantMeta) : {};
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    mobile: row.mobile,
    metadata: meta,
    created_at: row.created_at,
  };
}

export const PARTICIPANT_PAGE_SIZE = 25;
