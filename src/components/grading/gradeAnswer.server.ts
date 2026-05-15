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

    const SCHEMA = {
      type: "object",
      additionalProperties: false,
      required: ["points", "comment", "reasoning"],
      properties: {
        points: { type: "integer" },
        comment: { type: "string" },
        reasoning: { type: "string" },
      },
    } as const;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: GRADE_SYSTEM,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
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
