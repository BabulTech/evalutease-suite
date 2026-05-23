import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  computeClock,
  forgetAttempt,
  recallAttempt,
  rememberAttempt,
  type QuizPhase,
  type RegistrationValues,
  type SessionForJoin,
} from "@/components/quiz/types";
import {
  normalizeRegistrationFields,
  normalizeRegistrationFieldsByType,
} from "@/components/settings/host-settings";
import { routeForData, applySessionUpdate, mapJoinError } from "./helpers";

type RpcResponse<T> = T | { error: string };
type SessionPayload = {
  session: SessionForJoin["session"];
  registration_fields: unknown;
  registration_fields_by_type?: unknown;
  questions: SessionForJoin["questions"];
};
type SessionUpdate = Partial<SessionForJoin["session"]> & { access_code?: string | null };
type PendingAnswer = {
  attempt_id: string;
  question_id: string;
  answer: string | null;
  time_taken_seconds: number;
};

const ANSWER_BATCH_SIZE = 5;
const JOIN_LIMIT = 3;
const JOIN_WINDOW_MS = 60_000;

function checkJoinRateLimit(code: string): boolean {
  const key = `join_rl_${code}`;
  const raw = sessionStorage.getItem(key);
  const now = Date.now();
  const timestamps: number[] = raw ? (JSON.parse(raw) as number[]) : [];
  const recent = timestamps.filter((t) => now - t < JOIN_WINDOW_MS);
  if (recent.length >= JOIN_LIMIT) return false;
  recent.push(now);
  sessionStorage.setItem(key, JSON.stringify(recent));
  return true;
}

export function useQuizSession(code: string) {
  const [phase, setPhase] = useState<QuizPhase>({ kind: "loading" });
  const [now, setNow] = useState(() => Date.now());
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(new Set());
  const [localQuestionIndex, setLocalQuestionIndex] = useState<number | null>(null);
  const [localQuestionStartedAt, setLocalQuestionStartedAt] = useState(() => Date.now());
  const pendingAnswersRef = useRef<PendingAnswer[]>([]);
  const flushInFlightRef = useRef<Promise<void> | null>(null);
  const typedAnswerRef = useRef<string>("");

  const phaseRef = useRef(phase);
  // react-doctor-disable-next-line react-doctor/no-event-handler
  phaseRef.current = phase;
  // react-doctor-disable-next-line react-doctor/no-event-handler
  const localQuestionIndexRef = useRef(localQuestionIndex);
  localQuestionIndexRef.current = localQuestionIndex;
  const submitAnswerRef = useRef<
    ((qId: string, answer: string | null, timeTaken: number) => Promise<void>) | null
  >(null);
  const completeAttemptRef = useRef<(() => Promise<void>) | null>(null);

  const normalizeSessionPayload = useCallback(
    (payload: RpcResponse<SessionPayload>): SessionForJoin | null => {
      if ("error" in payload) {
        const msg =
          payload.error === "not_found"
            ? "That quiz PIN doesn't match an active session."
            : payload.error === "attempt_not_found"
              ? "Could not restore your quiz attempt."
              : "Could not load the session.";
        setPhase({ kind: "error", message: msg });
        return null;
      }
      return {
        session: payload.session,
        registration_fields: normalizeRegistrationFields(payload.registration_fields),
        registration_fields_by_type: normalizeRegistrationFieldsByType(
          payload.registration_fields_by_type,
        ),
        questions: (payload.questions ?? []).map((q) => {
          let type: import("@/components/quiz/types").QuizQuestionType =
            q.type === "mcq" ||
            q.type === "true_false" ||
            q.type === "short_answer" ||
            q.type === "long_answer"
              ? q.type
              : "mcq";
          if (type === "mcq" && (!q.options || q.options.length === 0)) {
            type = "long_answer";
          }
          return { ...q, type };
        }),
      };
    },
    [],
  );

  const fetchSession = useCallback(async (): Promise<SessionForJoin | null> => {
    const { data, error } = await supabase.rpc("get_session_for_join", { p_access_code: code });
    if (error) {
      setPhase({ kind: "error", message: error.message });
      return null;
    }
    return normalizeSessionPayload(data as RpcResponse<SessionPayload>);
  }, [code, normalizeSessionPayload]);

  const fetchPlaySession = useCallback(
    async (attemptId: string): Promise<SessionForJoin | null> => {
      const { data, error } = await supabase.rpc("get_session_for_play", {
        p_access_code: code,
        p_attempt_id: attemptId,
      });
      if (error) {
        setPhase({ kind: "error", message: error.message });
        return null;
      }
      return normalizeSessionPayload(data as RpcResponse<SessionPayload>);
    },
    [code, normalizeSessionPayload],
  );

  const reload = useCallback(async () => {
    const summary = await fetchSession();
    if (!summary) return;
    const rememberedAttempt = recallAttempt(summary.session.id);
    if (rememberedAttempt && summary.session.status === "active") {
      const playData = await fetchPlaySession(rememberedAttempt);
      if (!playData) return;
      setPhase((prev) => routeForData(playData, prev));
      return null;
    }
    setPhase((prev) => routeForData(summary, prev));
  }, [fetchPlaySession, fetchSession]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const handleSessionUpdate = async (newRow: SessionUpdate) => {
      const current = phaseRef.current;
      const currentAttempt =
        current.kind === "lobby" || current.kind === "quiz" || current.kind === "completed"
          ? current.attemptId
          : null;
      const needsQuestions =
        newRow.status === "active" &&
        currentAttempt &&
        (current.kind === "lobby" || current.kind === "quiz") &&
        current.data.questions.length === 0;
      if (needsQuestions) {
        const playData = await fetchPlaySession(currentAttempt);
        if (playData) setPhase((prev) => routeForData(playData, prev));
        return;
      }
      setPhase((prev) => applySessionUpdate(prev, newRow));
    };

    const channel = supabase
      .channel(`quiz-status-${code}`)
      .on("broadcast", { event: "status" }, async (payload) => {
        const newRow = payload.payload as SessionUpdate & { force_end?: boolean };
        if (newRow?.access_code && newRow.access_code !== code) return;
        if (newRow?.force_end) {
          const cur = phaseRef.current;
          if (cur.kind === "quiz") {
            const clock = computeClock(
              cur.data.session.started_at,
              cur.data.questions,
              cur.data.session.default_time_per_question,
              Date.now(),
              cur.data.session.paused_at,
              cur.data.session.pause_offset_seconds,
            );
            const question = cur.data.questions[clock.index];
            if (question && submitAnswerRef.current) {
              const isTyped = question.type === "long_answer" || question.type === "short_answer";
              const autoAnswer =
                isTyped && typedAnswerRef.current.trim() ? typedAnswerRef.current.trim() : null;
              typedAnswerRef.current = "";
              await submitAnswerRef.current(
                question.id,
                autoAnswer,
                question.time_seconds - clock.secondsLeft,
              );
            }
            if (completeAttemptRef.current) await completeAttemptRef.current();
          }
          return;
        }
        await handleSessionUpdate(newRow);
      })
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "quiz_sessions",
          filter: `access_code=eq.${code}`,
        },
        async (payload) => {
          await handleSessionUpdate(payload.new as SessionUpdate);
        },
      )
      .subscribe();
    return () => {
      void channel.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [code, fetchPlaySession]);

  const pendingAttemptId =
    phase.kind === "completed" && phase.hasPendingGrading ? phase.attemptId : null;

  useEffect(() => {
    if (!pendingAttemptId) return () => {};
    const channel = supabase
      .channel(`attempt-score-${pendingAttemptId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "quiz_attempts",
          filter: `id=eq.${pendingAttemptId}`,
        },
        (payload) => {
          const updated = payload.new as { score: number };
          setPhase((prev) => {
            if (prev.kind !== "completed") return prev;
            return { ...prev, score: updated.score, hasPendingGrading: false };
          });
        },
      )
      .subscribe();
    return () => {
      void channel.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [pendingAttemptId]);

  const flushAnswers = useCallback(async () => {
    if (flushInFlightRef.current) {
      await flushInFlightRef.current;
      return;
    }
    const batch = pendingAnswersRef.current.splice(0, ANSWER_BATCH_SIZE);
    if (batch.length === 0) return;
    flushInFlightRef.current = (async () => {
      const { error } = await supabase.rpc("submit_quiz_answers_batch", { p_answers: batch });
      if (error) {
        pendingAnswersRef.current = [...batch, ...pendingAnswersRef.current];
        throw error;
      }
    })();
    try {
      await flushInFlightRef.current;
    } finally {
      flushInFlightRef.current = null;
    }
    if (pendingAnswersRef.current.length >= ANSWER_BATCH_SIZE) {
      await flushAnswers();
    }
  }, []);

  useEffect(() => {
    const flushOnHide = () => {
      if (document.visibilityState === "hidden" && pendingAnswersRef.current.length > 0)
        void flushAnswers();
    };
    document.addEventListener("visibilitychange", flushOnHide);
    return () => document.removeEventListener("visibilitychange", flushOnHide);
  }, [flushAnswers]);

  const isPaused = phase.kind === "quiz" && !!phase.data.session.paused_at;

  useEffect(() => {
    if (phase.kind !== "quiz") return;
    if (isPaused) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [phase.kind, isPaused]);

  const wasPausedRef = useRef(false);
  useEffect(() => {
    if (phase.kind !== "quiz") {
      wasPausedRef.current = false;
      return;
    }
    if (isPaused) {
      wasPausedRef.current = true;
      return;
    }
    if (wasPausedRef.current) {
      const realNow = Date.now();
      // react-doctor-disable-next-line react-doctor/no-event-handler
      const gap = realNow - now;
      // react-doctor-disable-next-line react-doctor/no-derived-state
      if (gap > 0) setLocalQuestionStartedAt((prev) => prev + gap);
      // react-doctor-disable-next-line react-doctor/no-chain-state-updates
      setNow(realNow);
      wasPausedRef.current = false;
    }
  }, [phase.kind, isPaused, now]);

  // react-doctor-disable-next-line react-doctor/no-cascading-set-state
  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-cascading-set-state
    // react-doctor-disable-next-line react-doctor/no-chain-state-updates
    if (phase.kind !== "quiz") {
      setLocalQuestionIndex(null);
      return;
    }
    // react-doctor-disable-next-line react-doctor/no-chain-state-updates
    computeClock(
      phase.data.session.started_at,
      phase.data.questions,
      phase.data.session.default_time_per_question,
      now,
      phase.data.session.paused_at,
      phase.data.session.pause_offset_seconds,
    );
    // react-doctor-disable-next-line react-doctor/no-chain-state-updates
    setLocalQuestionIndex((current) => {
      if (current === null) {
        setLocalQuestionStartedAt(Date.now());
        return 0;
      }
      return current;
    });
  }, [phase, now]);

  useEffect(() => {
    if (phase.kind !== "lobby" && phase.kind !== "completed") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase.kind]);

  useEffect(() => {
    if (phase.kind !== "lobby" || !phase.data.session.scheduled_at) return;
    const scheduledMs = new Date(phase.data.session.scheduled_at).getTime();
    const isPast = Date.now() >= scheduledMs;
    const interval = isPast ? 2000 : 15000;
    const t = setInterval(() => void reload(), interval);
    return () => clearInterval(t);
  }, [phase, reload]);

  const join = useCallback(
    async (values: RegistrationValues) => {
      if (!checkJoinRateLimit(code)) {
        toast.error("Too many join attempts. Please wait a moment before trying again.");
        throw new Error("rate_limited");
      }
      const { data, error } = await supabase.rpc("join_quiz_session", {
        p_access_code: code,
        p_name: values.name?.trim() ?? "",
        p_email: values.email?.trim() || undefined,
        p_mobile: values.mobile?.trim() || undefined,
        p_roll_number: values.roll_number?.trim() || undefined,
      });
      if (error) {
        toast.error(error.message);
        throw error;
      }
      const payload = data as RpcResponse<{ attempt_id: string }>;
      if ("error" in payload) {
        const msg = mapJoinError(payload.error);
        toast.error(msg);
        throw new Error(msg);
      }
      const current = phaseRef.current;
      const currentData =
        current.kind === "register" || current.kind === "lobby" || current.kind === "quiz"
          ? current.data
          : null;
      const fresh =
        currentData?.session.status === "active"
          ? await fetchPlaySession(payload.attempt_id)
          : (currentData ?? (await fetchSession()));
      if (!fresh) throw new Error("Join failed: could not load session");
      rememberAttempt(fresh.session.id, payload.attempt_id);
      setPhase(routeForData(fresh, { kind: "loading" }, payload.attempt_id));
    },
    [code, fetchPlaySession, fetchSession],
  );

  const submitAnswer = useCallback(
    async (questionId: string, answer: string | null, timeTaken: number) => {
      if (phaseRef.current.kind !== "quiz") return;
      const attemptId = phaseRef.current.attemptId;
      pendingAnswersRef.current.push({
        attempt_id: attemptId,
        question_id: questionId,
        answer,
        time_taken_seconds: Math.max(0, timeTaken),
      });
      if (pendingAnswersRef.current.length >= ANSWER_BATCH_SIZE) {
        try {
          await flushAnswers();
        } catch (e) {
          console.error("submit_quiz_answers_batch", e);
        }
      }
      setAnsweredQuestionIds((prev) => {
        const next = new Set(prev);
        next.add(questionId);
        return next;
      });
    },
    [flushAnswers],
  );

  const completeAttempt = useCallback(async () => {
    if (phaseRef.current.kind !== "quiz") return;
    const ph = phaseRef.current;
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    try {
      while (pendingAnswersRef.current.length > 0) {
        await flushAnswers();
      }
    } catch (e) {
      console.error("submit_quiz_answers_batch", e);
    }
    const { data } = await supabase.rpc("complete_quiz_attempt", { p_attempt_id: ph.attemptId });
    const payload = data as
      | {
          score: number;
          total: number;
          speed_bonus: number;
          show_results_after_quiz?: boolean;
          has_pending_grading?: boolean;
        }
      | { error: string };
    if (payload && "score" in payload) {
      forgetAttempt(ph.data.session.id);
      const sessionData =
        payload.show_results_after_quiz !== undefined
          ? { ...ph.data.session, show_results_after_quiz: payload.show_results_after_quiz }
          : ph.data.session;
      setPhase({
        kind: "completed",
        data: { ...ph.data, session: sessionData },
        attemptId: ph.attemptId,
        score: payload.score,
        total: payload.total,
        speedBonus: payload.speed_bonus ?? 0,
        hasPendingGrading: payload.has_pending_grading ?? false,
      });
    }
  }, [flushAnswers]);

  const advanceAfterAnswer = useCallback(() => {
    if (phaseRef.current.kind !== "quiz") return;
    const total = phaseRef.current.data.questions.length;
    setLocalQuestionIndex((current) => {
      const next = (current ?? 0) + 1;
      if (next >= total) {
        window.setTimeout(() => void completeAttempt(), 150);
        return current;
      }
      setLocalQuestionStartedAt(Date.now());
      return next;
    });
  }, [completeAttempt]);

  submitAnswerRef.current = submitAnswer;
  completeAttemptRef.current = completeAttempt;

  const lastSubmittedIndex = useRef<number>(-1);

  useEffect(() => {
    if (phase.kind !== "quiz") return;
    // react-doctor-disable-next-line react-doctor/no-event-handler
    const { data } = phase;
    const clock = computeClock(
      data.session.started_at,
      data.questions,
      data.session.default_time_per_question,
      // react-doctor-disable-next-line react-doctor/no-event-handler
      now,
      data.session.paused_at,
      data.session.pause_offset_seconds,
    );
    // react-doctor-disable-next-line react-doctor/no-event-handler
    if (clock.done) {
      const localIdx = localQuestionIndexRef.current;
      const allLocalDone = localIdx === null || localIdx >= data.questions.length;
      // react-doctor-disable-next-line react-doctor/no-event-handler
      if (allLocalDone) void completeAttempt();
      return;
    }
    const previous = clock.index - 1;
    // react-doctor-disable-next-line react-doctor/no-event-handler
    const localIdx = localQuestionIndexRef.current ?? 0;
    if (previous >= 0 && previous > lastSubmittedIndex.current && previous < localIdx) {
      const prevQuestion = data.questions[previous];
      // react-doctor-disable-next-line react-doctor/no-event-handler
      if (prevQuestion && !answeredQuestionIds.has(prevQuestion.id)) {
        const elapsed = prevQuestion.time_seconds || data.session.default_time_per_question;
        void submitAnswer(prevQuestion.id, null, elapsed);
      }
      lastSubmittedIndex.current = previous;
    }
  }, [phase, now, completeAttempt, submitAnswer, answeredQuestionIds]);

  // react-doctor-disable-next-line react-doctor/no-event-handler
  useEffect(() => {
    if (phase.kind !== "quiz") return;
    // react-doctor-disable-next-line react-doctor/no-event-handler
    if (phase.data.session.paused_at) return;
    // react-doctor-disable-next-line react-doctor/no-event-handler
    const { started_at, total_duration_seconds, pause_offset_seconds } = phase.data.session;
    if (!started_at || !total_duration_seconds) return;
    // react-doctor-disable-next-line react-doctor/no-event-handler
    const elapsed =
      Math.floor((now - new Date(started_at).getTime()) / 1000) - (pause_offset_seconds ?? 0);
    // react-doctor-disable-next-line react-doctor/no-event-handler
    if (elapsed >= total_duration_seconds) void completeAttempt();
  }, [phase, now, completeAttempt]);

  useEffect(() => {
    // react-doctor-disable-next-line react-doctor/no-event-handler
    if (phase.kind !== "quiz" || localQuestionIndex === null) return;
    if (phase.data.session.paused_at) return;
    const question = phase.data.questions[localQuestionIndex];
    if (!question || answeredQuestionIds.has(question.id)) return;
    const totalSeconds = question.time_seconds || phase.data.session.default_time_per_question;
    const elapsed = Math.floor((now - localQuestionStartedAt) / 1000);
    if (elapsed < totalSeconds) return;
    const isTyped = question.type === "long_answer" || question.type === "short_answer";
    const autoAnswer =
      isTyped && typedAnswerRef.current.trim() ? typedAnswerRef.current.trim() : null;
    // react-doctor-disable-next-line react-doctor/no-derived-state
    typedAnswerRef.current = "";
    // react-doctor-disable-next-line react-doctor/no-derived-state
    void submitAnswer(question.id, autoAnswer, totalSeconds);
    // react-doctor-disable-next-line react-doctor/no-derived-state
    advanceAfterAnswer();
  }, [
    phase,
    localQuestionIndex,
    localQuestionStartedAt,
    now,
    answeredQuestionIds,
    submitAnswer,
    advanceAfterAnswer,
  ]);

  return {
    phase,
    now,
    answeredQuestionIds,
    localQuestionIndex,
    localQuestionStartedAt,
    isPaused,
    typedAnswerRef,
    join,
    submitAnswer,
    completeAttempt,
    advanceAfterAnswer,
    reload,
  };
}
