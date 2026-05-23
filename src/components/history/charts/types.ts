export type HistoryTrends = {
  weeklyAverage: { label: string; avgScore: number }[];
  weeklyParticipants: { label: string; participants: number }[];
  monthlyCompletion: { label: string; completionRate: number }[];
  monthlyQuizCount: { label: string; quizzes: number }[];
};

export type TrendDir = "up" | "down" | "flat";
