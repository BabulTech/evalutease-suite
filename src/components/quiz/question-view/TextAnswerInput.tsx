import { Send } from "lucide-react";

const MAX_SHORT_ANSWER_CHARS = 200;

type Props = {
  type: "short_answer" | "long_answer";
  value: string;
  isAnswered: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onTyping?: (value: string) => void;
  onSubmit: () => void;
};

export function TextAnswerInput({
  type,
  value,
  isAnswered,
  disabled,
  onChange,
  onTyping,
  onSubmit,
}: Props) {
  const maxLen = type === "short_answer" ? MAX_SHORT_ANSWER_CHARS : 4000;

  const handleChange = (raw: string) => {
    const v = raw.slice(0, maxLen);
    onChange(v);
    onTyping?.(v);
  };

  const submitLabel =
    type === "short_answer"
      ? isAnswered
        ? "Locked in"
        : "Submit Answer"
      : isAnswered
        ? "Submitted"
        : "Submit Answer";

  const btnClass = `w-full flex items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 font-semibold transition-all ${
    disabled || !value.trim()
      ? "border-border bg-card/30 text-muted-foreground cursor-not-allowed"
      : "border-primary bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90 cursor-pointer"
  }`;

  return (
    <div className="mt-6 space-y-3">
      {type === "short_answer" ? (
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim() && !disabled) {
                e.preventDefault();
                onSubmit();
              }
            }}
            aria-label="Short answer"
            disabled={disabled}
            placeholder="Type your answer…"
            className="w-full rounded-2xl border-2 border-border bg-card/40 p-4 text-base font-medium focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            maxLength={maxLen}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {value.length}/{maxLen}
          </div>
        </div>
      ) : (
        <textarea
          aria-label="Long answer"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          rows={8}
          placeholder="Write your answer…"
          className="w-full rounded-2xl border-2 border-border bg-card/40 px-4 py-3 text-base font-medium resize-none focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
        />
      )}
      <button
        type="button"
        disabled={disabled || !value.trim()}
        onClick={onSubmit}
        className={btnClass}
      >
        <Send className="size-4" />
        {submitLabel}
      </button>
    </div>
  );
}
