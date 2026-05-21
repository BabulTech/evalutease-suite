import { createServerFn } from "@tanstack/react-start";
import Anthropic from "@anthropic-ai/sdk";

type GradeInput = {
  questionText: string;
  questionType: "short_answer" | "long_answer";
  modelAnswer: string;
  rubric: string;
  studentAnswer: string;
  maxPoints: number;
};

type GradeResult = {
  points: number;
  comment: string;
  reasoning: string;
};

const GRADE_SYSTEM = `You are a fair, experienced examiner grading student answers. You will receive:
- The question
- An optional model answer (reference)
- An optional rubric (grading criteria)
- The student's answer
- The maximum points available

Return ONLY JSON with this exact schema:
{
  "points": <integer 0 to maxPoints>,
  "comment": "<one sentence of feedback for the student>",
  "reasoning": "<one sentence explaining why you gave this score>"
}

Rules:
- Be fair and consistent. Award full points for correct, complete answers even if worded differently.
- Award partial points when the answer is partially correct or shows understanding but lacks completeness.
- Award 0 for wrong, blank, or completely off-topic answers.
- If there is no model answer or rubric, use your subject-matter knowledge.
- Keep feedback constructive and brief.`;

// ─── Batch grading ────────────────────────────────────────────────

type BatchQuestion = {
  id: string;
  questionText: string;
  questionType: "short_answer" | "long_answer";
  studentAnswer: string;
  maxPoints: number;
  modelAnswer?: string;
  rubric?: string;
};

type BatchResult = {
  id: string;
  points: number;
  comment: string;
  reasoning: string;
};

const BATCH_SYSTEM = `You are a fair, experienced examiner grading student answers.
You will receive a list of questions with student answers and max points for each.

CRITICAL OUTPUT FORMAT:
- Respond with ONLY a raw JSON array. No prose, no explanation, no markdown code fences.
- Your entire response must start with [ and end with ].
- Each element must match this exact schema:
  { "id": "<question id from input>", "points": <integer 0 to maxPoints>, "comment": "<one sentence feedback>", "reasoning": "<one sentence why>" }
- Include exactly one element per question in the input, using the exact id provided.

Grading rules:
- Award full points for correct, complete answers even if worded differently from the model answer.
- Award partial points when partially correct or shows understanding but lacks completeness.
- Award 0 for wrong, blank, or completely off-topic answers.
- Keep feedback constructive and brief.`;

export const gradeAllAnswersWithAi = createServerFn({ method: "POST" })
  .inputValidator((data: unknown): { questions: BatchQuestion[] } => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid input");
    const v = data as Record<string, unknown>;
    if (!Array.isArray(v.questions) || v.questions.length === 0) throw new Error("questions array required");
    return { questions: v.questions as BatchQuestion[] };
  })
  .handler(async ({ data }): Promise<{ results: BatchResult[] }> => {
    const client = getClient();

    const questionsText = data.questions.map((q, i) => [
      `--- Question ${i + 1} (id: ${q.id}) ---`,
      `Question: ${q.questionText}`,
      q.modelAnswer ? `Model Answer: ${q.modelAnswer}` : "",
      q.rubric ? `Rubric: ${q.rubric}` : "",
      `Student's Answer: ${q.studentAnswer || "(no answer submitted)"}`,
      `Maximum Points: ${q.maxPoints}`,
    ].filter(Boolean).join("\n")).join("\n\n");

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256 * data.questions.length,
      system: BATCH_SYSTEM,
      messages: [{ role: "user", content: questionsText }],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("AI returned no content");

    let parsed: { id?: string; points?: number; comment?: string; reasoning?: string }[];
    const raw = block.text.trim();
    // Try direct parse, then extract from markdown fences, then find first [ ... ] block
    const tryParse = (s: string) => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : null; } catch { return null; } };
    parsed = tryParse(raw)
      ?? tryParse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""))
      ?? (() => {
        const start = raw.indexOf("[");
        const end = raw.lastIndexOf("]");
        return start >= 0 && end > start ? tryParse(raw.slice(start, end + 1)) : null;
      })()
      ?? null as any;
    if (!parsed) {
      console.error("AI returned non-JSON:", raw.slice(0, 500));
      throw new Error("Could not parse AI batch grading response");
    }

    const qMap = Object.fromEntries(data.questions.map((q) => [q.id, q]));
    const results: BatchResult[] = parsed.map((item) => {
      const q = qMap[item.id ?? ""];
      const maxPts = q?.maxPoints ?? 1;
      return {
        id: String(item.id ?? ""),
        points: Math.max(0, Math.min(maxPts, Math.round(Number(item.points ?? 0)))),
        comment: String(item.comment ?? "").trim(),
        reasoning: String(item.reasoning ?? "").trim(),
      };
    });

    return { results };
  });

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("AI grading is not configured: ANTHROPIC_API_KEY missing.");
  return new Anthropic({ apiKey });
}

export const gradeAnswerWithAi = createServerFn({ method: "POST" })
  .inputValidator((data: unknown): GradeInput => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid input");
    const v = data as Record<string, unknown>;
    const questionText = typeof v.questionText === "string" ? v.questionText.trim() : "";
    const questionType = v.questionType as GradeInput["questionType"];
    const modelAnswer = typeof v.modelAnswer === "string" ? v.modelAnswer : "";
    const rubric = typeof v.rubric === "string" ? v.rubric : "";
    const studentAnswer = typeof v.studentAnswer === "string" ? v.studentAnswer : "";
    const maxPoints = typeof v.maxPoints === "number" ? v.maxPoints : 1;
    if (!questionText) throw new Error("questionText is required");
    if (!["short_answer", "long_answer"].includes(questionType)) throw new Error("invalid questionType");
    if (!Number.isInteger(maxPoints) || maxPoints < 1 || maxPoints > 100) throw new Error("invalid maxPoints");
    return { questionText, questionType, modelAnswer, rubric, studentAnswer, maxPoints };
  })
  .handler(async ({ data }): Promise<GradeResult> => {
    const client = getClient();

    const parts = [
      `Question: ${data.questionText}`,
      data.modelAnswer ? `Model Answer: ${data.modelAnswer}` : "",
      data.rubric ? `Rubric: ${data.rubric}` : "",
      `Student's Answer: ${data.studentAnswer || "(no answer submitted)"}`,
      `Maximum Points: ${data.maxPoints}`,
    ].filter(Boolean).join("\n\n");

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: GRADE_SYSTEM,
      messages: [{ role: "user", content: parts }],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("AI returned no content");

    let parsed: { points?: number; comment?: string; reasoning?: string };
    try {
      parsed = JSON.parse(block.text);
    } catch {
      throw new Error("Could not parse AI grading response as JSON");
    }

    const points = Math.max(0, Math.min(data.maxPoints, Math.round(Number(parsed.points ?? 0))));
    const comment = String(parsed.comment ?? "").trim();
    const reasoning = String(parsed.reasoning ?? "").trim();

    return { points, comment, reasoning };
  });
