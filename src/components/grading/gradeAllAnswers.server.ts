import { createServerFn } from "@tanstack/react-start";
import type { BatchQuestion, BatchResult } from "./grading.types";
import { BATCH_SYSTEM } from "./grading.prompts";
import { getClient, parseBatchJson } from "./grading.utils";

export { BatchQuestion, BatchResult };

export const gradeAllAnswersWithAi = createServerFn({ method: "POST" })
  .inputValidator((data: unknown): { questions: BatchQuestion[] } => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid input");
    const v = data as Record<string, unknown>;
    if (!Array.isArray(v.questions) || v.questions.length === 0)
      throw new Error("questions array required");
    return { questions: v.questions as BatchQuestion[] };
  })
  .handler(async ({ data }): Promise<{ results: BatchResult[] }> => {
    const client = getClient();

    const questionsText = data.questions
      .map((q, i) =>
        [
          `--- Question ${i + 1} (id: ${q.id}) ---`,
          `Question: ${q.questionText}`,
          q.modelAnswer ? `Model Answer: ${q.modelAnswer}` : "",
          q.rubric ? `Rubric: ${q.rubric}` : "",
          `Student's Answer: ${q.studentAnswer || "(no answer submitted)"}`,
          `Maximum Points: ${q.maxPoints}`,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n\n");

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256 * data.questions.length,
      system: BATCH_SYSTEM,
      messages: [{ role: "user", content: questionsText }],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("AI returned no content");

    const raw = block.text.trim();
    if (!raw) {
      console.error("AI returned empty response");
      throw new Error("Could not parse AI batch grading response");
    }

    const parsed = parseBatchJson(raw);

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
