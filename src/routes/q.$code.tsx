import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Registration } from "@/components/quiz/Registration";
import { Lobby } from "@/components/quiz/Lobby";
import { QuestionView } from "@/components/quiz/QuestionView";
import { Completion } from "@/components/quiz/Completion";
import {
  computeClock,
  forgetAttempt,
  recallAttempt,
  rememberAttempt,
  type QuizPhase,
  type RegistrationValues,
  type SessionForJoin,
} from "@/components/quiz/types";
import { normalizeRegistrationFields } from "@/components/settings/host-settings";

export const Route = createFileRoute("/q/$code")({ component: PublicQuizPage });

type RpcResponse<T> = T | { error: string };

function PublicQuizPage() {
  const { code } = Route.useParams();
  const [phase, setPhase] = useState<QuizPhase>({ kind: "loading" });
  const [now, setNow] = useState(() => Date.now());
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(new Set());

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const fetchSession = useCallback(async (): Promise<SessionForJoin | null> => {
    const { data, error } = await supabase.rpc("get_session_for_join", {
      p_access_code: code,
    });
    if (error) {
      setPhase({ kind: "error", message: error.message });
      return null;
    }
    const payload = data as RpcResponse<{
      session: SessionForJoin["session"];
      registration_fields: unknown;
      questions: SessionForJoin["questions"];
    }>;
    if ("error" in payload) {
      const msg =
        payload.error === "not_found"
          ? "That quiz PIN doesn't match an active session."
          : "Could not load the session.";
      setPhase({ kind: "error", message: msg });
      return null;
    }
    return {
      session: payload.session,
      registration_fields: normalizeRegistrationFields(payload.registration_fields),
      questions: payload.questions ?? [],
    };
  }, [code]);

  const reload = useCallback(async () => {
    const data = await fetchSession();
    if (!data) return;
    setPhase((prev) => routeForData(data, prev));
  }, [fetchSession]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const channel = supabase
      .channel(`q-${code}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quiz_sessions" },
        (payload) => {
          const newRow = payload.new as { access_code?: string | null };
          if (newRow?.access_code === code) {
            void reload();
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [code, reload]);

  useEffect(() => {
    if (phase.kind !== "quiz") return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [phase.kind]);

  useEffect(() => {
    if (phase.kind !== "lobby" && phase.kind !== "completed") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase.kind]);

  const join = useCallback(
    async (values: RegistrationValues) => {
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
      const fresh = await fetchSession();
      if (!fresh) throw new Error("Join failed: could not reload session");
      rememberAttempt(fresh.session.id, payload.attempt_id);
      setPhase(routeForData(fresh, { kind: "loading" }, payload.attempt_id));
    },
    [code, fetchSession],
  );

  const submitAnswer = useCallback(
    async (questionId: string, answer: string | null, timeTaken: number) => {
      if (phaseRef.current.kind !== "quiz") return;
      const attemptId = phaseRef.current.attemptId;
      try {
        await supabase.rpc("submit_quiz_answer", {
          p_attempt_id: attemptId,
          p_question_id: questionId,
          p_answer: answer,
          p_time_taken_seconds: Math.max(0, timeTaken),
        });
      } catch (e) {
        console.error("submit_quiz_answer", e);
      }
      setAnsweredQuestionIds((prev) => {
        const next = new Set(prev);
        next.add(questionId);
        return next;
      });
    },
    [],
  );

  const completeAttempt = useCallback(async () => {
    if (phaseRef.current.kind !== "quiz") return;
    const ph = phaseRef.current;
    const { data } = await supabase.rpc("complete_quiz_attempt", {
      p_attempt_id: ph.attemptId,
    });
    const payload = data as
      | { score: number; total: number; speed_bonus: number }
      | { error: string };
    if (payload && "score" in payload) {
      forgetAttempt(ph.data.session.id);
      setPhase({
        kind: "completed",
        data: ph.data,
        attemptId: ph.attemptId,
        score: payload.score,
        total: payload.total,
        speedBonus: payload.speed_bonus ?? 0,
      });
    }
  }, []);

  const lastSubmittedIndex = useRef<number>(-1);

  useEffect(() => {
    if (phase.kind !== "quiz") return;
    const { data } = phase;
    const clock = computeClock(
      data.session.started_at,
      data.questions,
      data.session.default_time_per_question,
      now,
    );

    if (clock.done) {
      void completeAttempt();
      return;
    }

    const previous = clock.index - 1;
    if (previous >= 0 && previous > lastSubmittedIndex.current) {
      const prevQuestion = data.questions[previous];
      if (prevQuestion && !answeredQuestionIds.has(prevQuestion.id)) {
        const elapsed = prevQuestion.time_seconds || data.session.default_time_per_question;
        void submitAnswer(prevQuestion.id, null, elapsed);
      }
      lastSubmittedIndex.current = previous;
    }
  }, [phase, now, completeAttempt, submitAnswer, answeredQuestionIds]);

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
          onSubmit={join}
        />
      </Wrapper>
    );
  }
  if (phase.kind === "lobby") {
    return (
      <Wrapper>
        <Lobby session={phase.data.session} />
      </Wrapper>
    );
  }
  if (phase.kind === "quiz") {
    const clock = computeClock(
      phase.data.session.started_at,
      phase.data.questions,
      phase.data.session.default_time_per_question,
      now,
    );
    const question = phase.data.questions[clock.index];
    if (!question) {
      return (
        <Wrapper>
          <Lobby session={phase.data.session} />
        </Wrapper>
      );
    }
    const totalSeconds = question.time_seconds || phase.data.session.default_time_per_question;
    const timeTaken = totalSeconds - clock.secondsLeft;
    return (
      <Wrapper>
        <QuestionView
          question={question}
          total={phase.data.questions.length}
          index={clock.index}
          secondsLeft={clock.secondsLeft}
          totalSeconds={totalSeconds}
          isAnswered={answeredQuestionIds.has(question.id)}
          onLockAnswer={async (option) => {
            await submitAnswer(question.id, option, Math.max(0, timeTaken));
          }}
        />
      </Wrapper>
    );
  }
  if (phase.kind === "completed") {
    return (
      <Wrapper>
        <Completion
          session={phase.data.session}
          score={phase.score}
          total={phase.total}
          speedBonus={phase.speedBonus}
        />
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

function mapJoinError(code: string): string {
  switch (code) {
    case "not_found":
      return "That quiz PIN isn't recognised.";
    case "session_closed":
      return "This session has already finished.";
    case "not_invited":
      return "Sorry, you're not on this quiz's invited roster. Check with the host.";
    case "name_required":
      return "Name is required to join.";
    default:
      return "Could not join the session.";
  }
}
