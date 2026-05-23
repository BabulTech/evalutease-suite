import { createServerFn } from "@tanstack/react-start";
import type { GradeInput, GradeResult } from "./grading.types";
import { GRADE_SYSTEM } from "./grading.prompts";
import { getClient } from "./grading.utils";

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
    if (!["short_answer", "long_answer"].includes(questionType))
      throw new Error("invalid questionType");
    if (!Number.isInteger(maxPoints) || maxPoints < 1 || maxPoints > 100)
      throw new Error("invalid maxPoints");
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
    ]
      .filter(Boolean)
      .join("\n\n");

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

    return {
      points: Math.max(0, Math.min(data.maxPoints, Math.round(Number(parsed.points ?? 0)))),
      comment: String(parsed.comment ?? "").trim(),
      reasoning: String(parsed.reasoning ?? "").trim(),
    };
  });
