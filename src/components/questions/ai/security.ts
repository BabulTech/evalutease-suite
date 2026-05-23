import { MAX_TOPIC_LENGTH, MAX_HINT_LENGTH } from "./types";

export const OFF_TOPIC_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above|system)\s+(instructions?|prompts?|rules?)/i,
  /forget\s+(everything|all|your\s+instructions?|what\s+you)/i,
  /\b(jailbreak|DAN|do anything now|bypass|override|disregard)\b/i,
  /you are now|pretend (to be|you are)|act as (a|an) (?!quiz)/i,
  /\b(write|generate|create|make)\s+(a\s+)?(story|poem|essay|novel|song|lyrics|recipe|joke|code|script|program|function)\b/i,
  /\b(debug|fix|refactor|implement|help\s+me\s+(code|program|build|create))\b/i,
  /\b(how\s+to\s+hack|penetration\s+test|sql\s+injection|xss|exploit|malware|virus|phishing)\b/i,
];

export function validateTopic(topic: string): void {
  if (!topic.trim()) throw new Error("topic is required");
  if (topic.length > MAX_TOPIC_LENGTH)
    throw new Error(`Topic must be ${MAX_TOPIC_LENGTH} characters or fewer`);
  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(topic))
      throw new Error(
        "Topic must be an educational subject. AI is available only for quiz question generation.",
      );
  }
}

export function sanitizeHint(hint: string): string {
  return hint.slice(0, MAX_HINT_LENGTH);
}

/** Strip angle brackets so user input cannot escape XML delimiter tags. */
export function stripTags(value: string): string {
  return value.replace(/[<>]/g, "");
}

/** Wrap user input in delimited tags to prevent prompt injection. */
export function wrapUserField(label: string, value: string): string {
  return `<user_${label}>${stripTags(value)}</user_${label}>`;
}
