import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Registration } from "@/components/quiz/Registration";
import { Lobby } from "@/components/quiz/Lobby";
import { QuestionView } from "@/components/quiz/QuestionView";
import {
  computeClock,
  forgetAttempt,
  recallAttempt,
  rememberAttempt,
  type QuizPhase,
  type RegistrationValues,
  type SessionForJoin,
} from "@/components/quiz/types";
import { normalizeRegistrationFields, normalizeRegistrationFieldsByType } from "@/components/settings/host-settings";

export const Route = createFileRoute("/q/$code")({ component: PublicQuizPage });

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

// Abuse protection: max 3 join attempts per session per 60 s
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
const LazyCompletion = lazy(() =>
  import("@/components/quiz/Completion").then((module) => ({
    default: module.Completion,
  })),
);

function PublicQuizPage() {
  const { code } = Route.useParams();
  const [phase, setPhase] = useState<QuizPhase>({ kind: "loading" });
  const [now, setNow] = useState(() => Date.now());
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(new Set());
  const [localQuestionIndex, setLocalQuestionIndex] = useState<number | null>(null);
  const [localQuestionStartedAt, setLocalQuestionStartedAt] = useState(() => Date.now());
  const pendingAnswersRef = useRef<PendingAnswer[]>([]);
  const flushInFlightRef = useRef<Promise<void> | null>(null);
  // Tracks typed text for long/short answer so timer-expiry auto-submits it
  const typedAnswerRef = useRef<string>("");

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const localQuestionIndexRef = useRef(localQuestionIndex);
  localQuestionIndexRef.current = localQuestionIndex;
  const submitAnswerRef = useRef<((qId: string, answer: string | null, timeTaken: number) => Promise<void>) | null>(null);
  const completeAttemptRef = useRef<(() => Promise<void>) | null>(null);

  const normalizeSessionPayload = useCallback((payload: RpcResponse<SessionPayload>): SessionForJoin | null => {
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
      registration_fields_by_type: normalizeRegistrationFieldsByType(payload.registration_fields_by_type),
      questions: (payload.questions ?? []).map((q) => {
        // Prefer the DB-supplied type; fall back to inference for old rows where type is NULL
        let type: import("@/components/quiz/types").QuizQuestionType =
          q.type === "mcq" || q.type === "true_false"
          || q.type === "short_answer" || q.type === "long_answer"
            ? q.type : "mcq";
        if (type === "mcq" && (!q.options || q.options.length === 0)) {
          // No options → can't be MCQ; best guess is long_answer
          type = "long_answer";
        }
        return { ...q, type };
      }),
    };
  }, []);

  const fetchSession = useCallback(async (): Promise<SessionForJoin | null> => {
    const { data, error } = await supabase.rpc("get_session_for_join", {
      p_access_code: code,
    });
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
      .on(
        "broadcast",
        { event: "status" },
        async (payload) => {
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
                const autoAnswer = isTyped && typedAnswerRef.current.trim() ? typedAnswerRef.current.trim() : null;
                typedAnswerRef.current = "";
                await submitAnswerRef.current(question.id, autoAnswer, question.time_seconds - clock.secondsLeft);
              }
              if (completeAttemptRef.current) await completeAttemptRef.current();
            }
            return;
          }
          await handleSessionUpdate(newRow);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quiz_sessions", filter: `access_code=eq.${code}` },
        async (payload) => {
          await handleSessionUpdate(payload.new as SessionUpdate);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [code, fetchPlaySession]);

  // Watch for score updates after grading — only when participant is waiting for grading
  const pendingAttemptId =
    phase.kind === "completed" && phase.hasPendingGrading ? phase.attemptId : null;

  useEffect(() => {
    if (!pendingAttemptId) return () => {};
    const channel = supabase
      .channel(`attempt-score-${pendingAttemptId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quiz_attempts", filter: `id=eq.${pendingAttemptId}` },
        (payload) => {
          const updated = payload.new as { score: number };
          setPhase((prev) => {
            if (prev.kind !== "completed") return prev;
            return { ...prev, score: updated.score, hasPendingGrading: false };
          });
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [pendingAttemptId]);

  const flushAnswers = useCallback(async () => {
    if (flushInFlightRef.current) {
      await flushInFlightRef.current;
      return;
    }
    const batch = pendingAnswersRef.current.splice(0, ANSWER_BATCH_SIZE);
    if (batch.length === 0) return;
    flushInFlightRef.current = (async () => {
      const { error } = await supabase.rpc("submit_quiz_answers_batch", {
        p_answers: batch,
      });
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
      if (document.visibilityState === "hidden" && pendingAnswersRef.current.length > 0) {
        void flushAnswers();
      }
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
      const gap = realNow - now;
      if (gap > 0) setLocalQuestionStartedAt((prev) => prev + gap);
      setNow(realNow);
      wasPausedRef.current = false;
    }
  }, [phase.kind, isPaused, now]);

  useEffect(() => {
    if (phase.kind !== "quiz") {
      setLocalQuestionIndex(null);
      return;
    }
    const clock = computeClock(
      phase.data.session.started_at,
      phase.data.questions,
      phase.data.session.default_time_per_question,
      now,
      phase.data.session.paused_at,
      phase.data.session.pause_offset_seconds,
    );
    setLocalQuestionIndex((current) => {
      // Initialize at Q1 (index 0) for everyone — local timer handles advancing
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
    // Poll every 2s once scheduled time is reached, otherwise every 15s
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
        p_email: values.email?.trim() || null,
        p_mobile: values.mobile?.trim() || null,
        p_roll_number: values.roll_number?.trim() || null,
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
          : currentData ?? (await fetchSession());
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
    try {
      while (pendingAnswersRef.current.length > 0) {
        await flushAnswers();
      }
    } catch (e) {
      console.error("submit_quiz_answers_batch", e);
    }
    const { data } = await supabase.rpc("complete_quiz_attempt", {
      p_attempt_id: ph.attemptId,
    });
    const payload = data as
      | { score: number; total: number; speed_bonus: number; show_results_after_quiz?: boolean; has_pending_grading?: boolean }
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
  }, []);

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

  // Keep refs in sync so the force_end handler can call them
  submitAnswerRef.current = submitAnswer;
  completeAttemptRef.current = completeAttempt;

  const lastSubmittedIndex = useRef<number>(-1);

  useEffect(() => {
    if (phase.kind !== "quiz") return;
    const { data } = phase;
    const clock = computeClock(
      data.session.started_at,
      data.questions,
      data.session.default_time_per_question,
      now,
      data.session.paused_at,
      data.session.pause_offset_seconds,
    );

    if (clock.done) {
      // Only complete if the participant has also finished all their local questions.
      // This prevents clock.done from immediately ending a late joiner who just started Q1.
      const localIdx = localQuestionIndexRef.current;
      const allLocalDone = localIdx === null || localIdx >= data.questions.length;
      if (allLocalDone) {
        void completeAttempt();
      }
      return;
    }

    const previous = clock.index - 1;
    // Only auto-null-submit questions the participant has already passed locally.
    // Without this guard, a late joiner on Q1 would have Q1 marked as answered the
    // moment the global clock advances to Q2, disabling all inputs and freezing the UI.
    const localIdx = localQuestionIndexRef.current ?? 0;
    if (previous >= 0 && previous > lastSubmittedIndex.current && previous < localIdx) {
      const prevQuestion = data.questions[previous];
      if (prevQuestion && !answeredQuestionIds.has(prevQuestion.id)) {
        const elapsed = prevQuestion.time_seconds || data.session.default_time_per_question;
        void submitAnswer(prevQuestion.id, null, elapsed);
      }
      lastSubmittedIndex.current = previous;
    }
  }, [phase, now, completeAttempt, submitAnswer, answeredQuestionIds]);

  // Complete attempt when total quiz wall-clock time runs out, even if the
  // participant (a late joiner) is still mid-question locally.
  useEffect(() => {
    if (phase.kind !== "quiz") return;
    if (phase.data.session.paused_at) return;
    const { started_at, total_duration_seconds, pause_offset_seconds } = phase.data.session;
    if (!started_at || !total_duration_seconds) return;
    const elapsed = Math.floor((now - new Date(started_at).getTime()) / 1000) - (pause_offset_seconds ?? 0);
    if (elapsed >= total_duration_seconds) {
      void completeAttempt();
    }
  }, [phase, now, completeAttempt]);

  useEffect(() => {
    if (phase.kind !== "quiz" || localQuestionIndex === null) return;
    if (phase.data.session.paused_at) return;
    const question = phase.data.questions[localQuestionIndex];
    if (!question || answeredQuestionIds.has(question.id)) return;
    const totalSeconds = question.time_seconds || phase.data.session.default_time_per_question;
    const elapsed = Math.floor((now - localQuestionStartedAt) / 1000);
    if (elapsed < totalSeconds) return;
    // For typed-answer types, auto-submit whatever the participant has typed
    const isTyped = question.type === "long_answer" || question.type === "short_answer";
    const autoAnswer = isTyped && typedAnswerRef.current.trim()
      ? typedAnswerRef.current.trim()
      : null;
    typedAnswerRef.current = "";
    void submitAnswer(question.id, autoAnswer, totalSeconds);
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

  if (phase.kind === "loading") {
    return <Wrapper>Loading session…</Wrapper>;
  }
  if (phase.kind === "error") {
    return (
      <Wrapper>
        <div className="rounded-3xl border border-border bg-card/60 p-8 max-w-md w-full text-center shadow-card">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/15 border border-destructive/30 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="mt-4 font-display text-xl font-bold">Can't open this quiz</h1>
          <p className="mt-2 text-sm text-muted-foreground">{phase.message}</p>
        </div>
      </Wrapper>
    );
  }
  if (phase.kind === "register") {
    return (
      <Wrapper>
        <Registration
          session={phase.data.session}
          fields={phase.data.registration_fields}
          fieldsByType={phase.data.registration_fields_by_type}
          onSubmit={join}
        />
      </Wrapper>
    );
  }
  if (phase.kind === "lobby") {
    return (
      <Wrapper>
        <Lobby session={phase.data.session} onScheduledTimeReached={reload} />
      </Wrapper>
    );
  }
  if (phase.kind === "quiz") {
    const sessionClock = computeClock(
      phase.data.session.started_at,
      phase.data.questions,
      phase.data.session.default_time_per_question,
      now,
    );
    const currentIndex = localQuestionIndex ?? sessionClock.index;
    const question = phase.data.questions[currentIndex];
    if (!question) {
      return (
        <Wrapper>
          <Suspense fallback={<div className="text-sm text-muted-foreground">Loading results…</div>}>
            <LazyCompletion
              session={phase.data.session}
              score={0}
              total={phase.data.session.total_questions}
              speedBonus={0}
            />
          </Suspense>
        </Wrapper>
      );
    }
    const totalSeconds = question.time_seconds || phase.data.session.default_time_per_question;
    const elapsed = Math.max(0, Math.floor((now - localQuestionStartedAt) / 1000));
    const secondsLeft = Math.max(0, totalSeconds - elapsed);
    const timeTaken = totalSeconds - secondsLeft;
    const quizSecondsLeft = phase.data.session.total_duration_seconds && phase.data.session.started_at
      ? Math.max(0, phase.data.session.total_duration_seconds - Math.floor((now - new Date(phase.data.session.started_at).getTime()) / 1000) + (phase.data.session.pause_offset_seconds ?? 0))
      : null;
    return (
      <Wrapper>
        <QuestionView
          question={question}
          total={phase.data.questions.length}
          index={currentIndex}
          secondsLeft={secondsLeft}
          totalSeconds={totalSeconds}
          quizSecondsLeft={quizSecondsLeft}
          isAnswered={answeredQuestionIds.has(question.id)}
          paused={isPaused}
          onTyping={(v) => { typedAnswerRef.current = v; }}
          onLockAnswer={async (option) => {
            typedAnswerRef.current = "";
            await submitAnswer(question.id, option, Math.max(0, timeTaken));
            advanceAfterAnswer();
          }}
        />
      </Wrapper>
    );
  }
  if (phase.kind === "completed") {
    return (
      <Wrapper>
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading results…</div>}>
          <LazyCompletion
            session={phase.data.session}
            score={phase.score}
            total={phase.total}
            speedBonus={phase.speedBonus}
            hasPendingGrading={phase.hasPendingGrading}
          />
        </Suspense>
      </Wrapper>
    );
  }
  return null;
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between">
        <Logo />
      </header>
      <main className="flex-1 flex items-center justify-center px-4 pb-10">{children}</main>
    </div>
  );
}

function routeForData(
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
      };
    }
    return { kind: "error", message: "This quiz session has already ended." };
  }

  // Block late joiners — if total quiz time has elapsed, show ended message
  if (session.status === "active" && session.started_at && session.total_duration_seconds) {
    const pauseOffset = session.pause_offset_seconds ?? 0;
    const elapsed = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000) - pauseOffset;
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

function applySessionUpdate(prev: QuizPhase, update: SessionUpdate): QuizPhase {
  if (prev.kind !== "register" && prev.kind !== "lobby" && prev.kind !== "quiz" && prev.kind !== "completed") {
    return prev;
  }
  // For completed phase, only allow show_results_after_quiz to update (don't re-route)
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

function mapJoinError(code: string): string {
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
