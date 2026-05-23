export type ParticipantShareData = {
  mode: "participant";
  quizTitle: string;
  score: number;
  total: number;
  pct: number;
  speedBonus?: number;
  participantName?: string;
};

export type HostShareData = {
  mode: "host";
  quizTitle: string;
  totalParticipants: number;
  submitted: number;
  avgPct: number;
  bestPct: number;
  passRate: number;
  topScorer?: string;
};
