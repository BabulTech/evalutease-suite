import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { FeedbackRow, SessionStat } from "./types";

export function useReviewsData(user: User | null) {
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStat[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: sessions, error: sessErr } = await supabase
      .from("quiz_sessions")
      .select("id, title, created_at")
      .eq("owner_id", user.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(50);

    if (sessErr) {
      toast.error(sessErr.message);
      setLoading(false);
      return;
    }

    const sessionList = sessions ?? [];
    if (sessionList.length === 0) {
      setFeedbacks([]);
      setSessionStats([]);
      setLoading(false);
      return;
    }

    const sessionIds = sessionList.map((s) => s.id);
    const titleById = new Map(sessionList.map((s) => [s.id, s.title]));

    const [feedbackRes, attemptsRes] = await Promise.all([
      supabase
        .from("quiz_feedback")
        .select(
          "id, session_id, participant_name, participant_email, rating, comment, submitted_at",
        )
        .in("session_id", sessionIds)
        .order("submitted_at", { ascending: false }),
      supabase
        .from("quiz_attempts")
        .select("id, session_id, score, total_questions, completed")
        .in("session_id", sessionIds)
        .eq("completed", true),
    ]);

    const completedAttempts = attemptsRes.data ?? [];
    const attemptIds = completedAttempts.map((a) => a.id);

    const { data: answerRows } =
      attemptIds.length > 0
        ? await supabase
            .from("quiz_answers")
            .select("attempt_id, is_correct")
            .in("attempt_id", attemptIds)
        : { data: [] };

    if (feedbackRes.error) toast.error(feedbackRes.error.message);

    const enriched: FeedbackRow[] = (feedbackRes.data ?? []).map((f) => ({
      ...f,
      session_title: titleById.get(f.session_id) ?? "Unknown quiz",
    }));
    setFeedbacks(enriched);

    const answersByAttempt = new Map<string, { correct: number; wrong: number }>();
    for (const a of answerRows ?? []) {
      const prev = answersByAttempt.get(a.attempt_id) ?? { correct: 0, wrong: 0 };
      if (a.is_correct === true) prev.correct++;
      else if (a.is_correct === false) prev.wrong++;
      answersByAttempt.set(a.attempt_id, prev);
    }

    const ratingsBySession = new Map<string, number[]>();
    for (const f of feedbackRes.data ?? []) {
      const arr = ratingsBySession.get(f.session_id) ?? [];
      arr.push(f.rating);
      ratingsBySession.set(f.session_id, arr);
    }

    const statsBySession = new Map<
      string,
      { pcts: number[]; correct: number; wrong: number; unattempted: number }
    >();
    for (const a of completedAttempts) {
      const prev = statsBySession.get(a.session_id) ?? {
        pcts: [],
        correct: 0,
        wrong: 0,
        unattempted: 0,
      };
      const pct = a.total_questions > 0 ? Math.round((a.score / a.total_questions) * 100) : 0;
      const ans = answersByAttempt.get(a.id) ?? { correct: 0, wrong: 0 };
      const unattempted = Math.max(0, a.total_questions - (ans.correct + ans.wrong));
      prev.pcts.push(pct);
      prev.correct += ans.correct;
      prev.wrong += ans.wrong;
      prev.unattempted += unattempted;
      statsBySession.set(a.session_id, prev);
    }

    const computed: SessionStat[] = sessionList.map((s) => {
      const st = statsBySession.get(s.id);
      const ratings = ratingsBySession.get(s.id) ?? [];
      const pcts = st?.pcts ?? [];
      return {
        id: s.id,
        title: s.title,
        created_at: s.created_at,
        participant_count: pcts.length,
        avg_pct: pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0,
        highest_pct: pcts.length > 0 ? Math.max(...pcts) : 0,
        lowest_pct: pcts.length > 0 ? Math.min(...pcts) : 0,
        total_correct: st?.correct ?? 0,
        total_wrong: st?.wrong ?? 0,
        total_unattempted: st?.unattempted ?? 0,
        avg_rating:
          ratings.length > 0
            ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
            : null,
        review_count: ratings.length,
      };
    });

    setSessionStats(computed);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return { feedbacks, sessionStats, loading };
}
