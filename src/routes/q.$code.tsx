import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { Registration } from "@/components/quiz/Registration";
import { Lobby } from "@/components/quiz/Lobby";
import { QuestionView } from "@/components/quiz/QuestionView";
import { computeClock } from "@/components/quiz/types";
import { Wrapper } from "./q/Wrapper";
import { useQuizSession } from "./q/useQuizSession";

// react-doctor-disable-next-line react-doctor/only-export-components
export const Route = createFileRoute("/q/$code")({ component: PublicQuizPage });

// react-doctor-disable-next-line react-doctor/only-export-components
const LazyCompletion = lazy(() =>
  import("@/components/quiz/Completion").then((module) => ({ default: module.Completion })),
);

// react-doctor-disable-next-line react-doctor/only-export-components
function PublicQuizPage() {
  const { code } = Route.useParams();
  const {
    phase,
    now,
    answeredQuestionIds,
    localQuestionIndex,
    localQuestionStartedAt,
    isPaused,
    typedAnswerRef,
    join,
    submitAnswer,
    advanceAfterAnswer,
    reload,
  } = useQuizSession(code);

  if (phase.kind === "loading") return <Wrapper>Loading session…</Wrapper>;

  if (phase.kind === "error") {
    return (
      <Wrapper>
        <div className="rounded-3xl border border-border bg-card/60 p-8 max-w-md w-full text-center shadow-card">
          <div className="mx-auto size-12 rounded-full bg-destructive/15 border border-destructive/30 flex items-center justify-center">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <h1 className="mt-4 font-display text-xl font-semibold">Can't open this quiz</h1>
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
          <Suspense
            fallback={<div className="text-sm text-muted-foreground">Loading results…</div>}
          >
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
    const quizSecondsLeft =
      phase.data.session.total_duration_seconds && phase.data.session.started_at
        ? Math.max(
            0,
            phase.data.session.total_duration_seconds -
              Math.floor((now - new Date(phase.data.session.started_at).getTime()) / 1000) +
              (phase.data.session.pause_offset_seconds ?? 0),
          )
        : null;
    return (
      <Wrapper>
        <QuestionView
          key={question.id}
          question={question}
          total={phase.data.questions.length}
          index={currentIndex}
          secondsLeft={secondsLeft}
          totalSeconds={totalSeconds}
          quizSecondsLeft={quizSecondsLeft}
          isAnswered={answeredQuestionIds.has(question.id)}
          paused={isPaused}
          onTyping={(v) => {
            typedAnswerRef.current = v;
          }}
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
