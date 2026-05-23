import type { PlanInfo, PlanUsage, PlanLimits } from "./types";

export function makeLimitHelpers(plan: PlanInfo, usage: PlanUsage) {
  const limitFor = (key: keyof PlanLimits): number =>
    ({
      quizzes_per_day: plan.quizzes_per_day,
      participants_per_session: plan.participants_per_session,
      participants_total: plan.participants_total,
      question_bank: plan.question_bank,
      sessions_total: plan.sessions_total,
    })[key];

  const usedFor = (key: keyof PlanLimits): number => {
    if (key === "quizzes_per_day") return usage.quizzes_today;
    if (key === "question_bank") return usage.questions_total;
    if (key === "participants_total") return usage.participants_total;
    if (key === "sessions_total") return usage.sessions_total;
    return 0;
  };

  const remaining = (key: keyof PlanLimits): number => {
    const limit = limitFor(key);
    if (limit === -1) return Infinity;
    return Math.max(0, limit - usedFor(key));
  };

  const isLocked = (key: keyof PlanLimits): boolean => {
    const limit = limitFor(key);
    if (limit === -1) return false;
    return usedFor(key) >= limit;
  };

  const usedPct = (key: keyof PlanLimits): number => {
    const limit = limitFor(key);
    if (limit === -1) return 0;
    return Math.min(100, Math.round((usedFor(key) / limit) * 100));
  };

  return { remaining, isLocked, usedPct };
}
