import { useMemo, useState } from "react";
import type { QuizQuestion } from "./types";
import { TimerBar } from "./question-view/TimerBar";
import { TrueFalseOptions } from "./question-view/TrueFalseOptions";
import { McqOptions } from "./question-view/McqOptions";
import { TextAnswerInput } from "./question-view/TextAnswerInput";
import { PauseOverlay } from "./question-view/PauseOverlay";

type Props = {
  question: QuizQuestion;
  total: number;
  index: number;
  secondsLeft: number;
  totalSeconds: number;
  quizSecondsLeft?: number | null;
  onLockAnswer: (answer: string) => Promise<void> | void;
  onTyping?: (value: string) => void;
  isAnswered: boolean;
  paused?: boolean;
};

export function QuestionView({
  question,
  total,
  index,
  secondsLeft,
  totalSeconds,
  quizSecondsLeft,
  onLockAnswer,
  onTyping,
  isAnswered,
  paused = false,
}: Props) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pct = useMemo(() => {
    if (!totalSeconds) return 0;
    return Math.max(0, Math.min(100, Math.round((secondsLeft / totalSeconds) * 100)));
  }, [secondsLeft, totalSeconds]);

  const lock = async (option: string) => {
    if (isAnswered || submitting || paused) return;
    setChosen(option);
    setSubmitting(true);
    try {
      await onLockAnswer(option);
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = isAnswered || submitting || paused;

  return (
    <div className="relative rounded-3xl border border-border bg-card/60 backdrop-blur p-6 sm:p-8 max-w-2xl w-full shadow-card">
      <TimerBar
        index={index}
        total={total}
        secondsLeft={secondsLeft}
        pct={pct}
        quizSecondsLeft={quizSecondsLeft}
      />

      <h2 className="mt-6 font-display text-xl sm:text-2xl font-semibold leading-snug">
        {question.text}
      </h2>

      {question.type === "true_false" && (
        <TrueFalseOptions
          chosen={chosen}
          isAnswered={isAnswered}
          disabled={disabled}
          onLock={(v) => void lock(v)}
        />
      )}

      {(question.type === "short_answer" || question.type === "long_answer") && (
        <TextAnswerInput
          type={question.type}
          value={typedAnswer}
          isAnswered={isAnswered}
          disabled={disabled}
          onChange={setTypedAnswer}
          onTyping={onTyping}
          onSubmit={() => void lock(typedAnswer.trim())}
        />
      )}

      {question.type === "mcq" && (
        <McqOptions
          options={question.options}
          chosen={chosen}
          isAnswered={isAnswered}
          disabled={disabled}
          onLock={(v) => void lock(v)}
        />
      )}

      <p className="mt-5 text-xs text-muted-foreground text-center">
        {isAnswered
          ? "Locked in. Waiting for the next question…"
          : chosen
            ? "Submitting…"
            : question.type === "short_answer" || question.type === "long_answer"
              ? "Type your answer and tap Submit. The next question loads automatically."
              : "Tap an option to lock your answer. The next question loads automatically."}
      </p>

      {paused && <PauseOverlay />}
    </div>
  );
}
