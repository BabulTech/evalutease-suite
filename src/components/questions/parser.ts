import {
  emptyDraft,
  MAX_QUESTION_LENGTH,
  OPTION_COUNT,
  type DraftQuestion,
  type Difficulty,
} from "./types";

const Q_PREFIX = /^(?:Q\s*[:.)]|Q\d+\s*[:.)]|\d+\s*[.)])\s*/i;
const OPT_PREFIX = /^([A-D])\s*[.)]\s*/i;

/**
 * Parse free-form text into MCQ drafts.
 *
 * Recognised format (lenient):
 *   Q: question text
 *   A) option one
 *   B) option two *
 *   C) option three
 *   D) option four
 *
 *   Q2: ...
 *
 * The trailing "*" (or "(correct)" / "[correct]") on an option marks it as correct.
 * Blocks separated by blank lines OR by a new "Q" prefix.
 */
export function parseStructuredQuestions(
  input: string,
  difficulty: Difficulty = "medium",
): DraftQuestion[] {
  const lines = input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim());
  const drafts: DraftQuestion[] = [];
  let current: DraftQuestion | null = null;

  const finalize = () => {
    if (!current) return;
    if (current.text && current.options.filter((o) => o).length === OPTION_COUNT) {
      drafts.push(current);
    }
    current = null;
  };

  for (const raw of lines) {
    if (!raw) {
      finalize();
      continue;
    }

    const qMatch = raw.match(Q_PREFIX);
    if (qMatch) {
      finalize();
      const text = raw.slice(qMatch[0].length).trim();
      current = emptyDraft(difficulty);
      current.text = text.slice(0, MAX_QUESTION_LENGTH);
      continue;
    }

    const optMatch = raw.match(OPT_PREFIX);
    if (optMatch && current) {
      const letter = optMatch[1].toUpperCase();
      const idx = letter.charCodeAt(0) - 65;
      if (idx < 0 || idx >= OPTION_COUNT) continue;
      let body = raw.slice(optMatch[0].length).trim();
      let isCorrect = false;
      const correctMarkers = [
        /\s*\*\s*$/,
        /\s*\(correct\)\s*$/i,
        /\s*\[correct\]\s*$/i,
        /\s*✓\s*$/,
      ];
      for (const m of correctMarkers) {
        if (m.test(body)) {
          isCorrect = true;
          body = body.replace(m, "").trim();
        }
      }
      current.options[idx] = body;
      if (isCorrect) current.correctIndex = idx;
      continue;
    }

    if (current && !current.text) {
      current.text = raw.slice(0, MAX_QUESTION_LENGTH);
    }
  }
  finalize();
  return drafts;
}

/**
 * Generate a deterministic batch of skeleton MCQ drafts for a topic.
 * No external AI call — produces editable templates the teacher fills in.
 */
export function generateSkeletonDrafts(opts: {
  topic: string;
  count: number;
  difficulty: Difficulty;
}): DraftQuestion[] {
  const topic = opts.topic.trim() || "this topic";
  const out: DraftQuestion[] = [];
  for (let i = 0; i < opts.count; i++) {
    const d = emptyDraft(opts.difficulty);
    d.text = `Q${i + 1}. About ${topic} — ${prompts[i % prompts.length]}`.slice(
      0,
      MAX_QUESTION_LENGTH,
    );
    d.options = ["Option A", "Option B", "Option C", "Option D"];
    d.correctIndex = 0;
    d.explanation = "";
    out.push(d);
  }
  return out;
}

const prompts = [
  "which statement is correct?",
  "which of the following is true?",
  "what is the best definition?",
  "identify the example below.",
  "what is the main cause?",
  "which option is the exception?",
  "which sequence is right?",
  "what is the result?",
  "which is most accurate?",
  "which describes it best?",
];
