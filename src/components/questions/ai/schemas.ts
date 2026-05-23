export const SCHEMA_MCQ = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "text", "options", "correctIndex", "explanation"],
        properties: {
          type: { type: "string", enum: ["mcq"] },
          text: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correctIndex: { type: "integer" },
          explanation: { type: "string" },
        },
      },
    },
  },
} as const;

export const SCHEMA_TF = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "text", "correctValue", "explanation"],
        properties: {
          type: { type: "string", enum: ["true_false"] },
          text: { type: "string" },
          correctValue: { type: "boolean" },
          explanation: { type: "string" },
        },
      },
    },
  },
} as const;

export const SCHEMA_SHORT = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "text", "acceptableAnswers", "explanation"],
        properties: {
          type: { type: "string", enum: ["short_answer"] },
          text: { type: "string" },
          acceptableAnswers: { type: "array", items: { type: "string" } },
          explanation: { type: "string" },
        },
      },
    },
  },
} as const;

export const SCHEMA_MIX = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "text", "explanation"],
        properties: {
          type: { type: "string", enum: ["mcq", "true_false", "short_answer", "long_answer"] },
          text: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correctIndex: { type: "integer" },
          correctValue: { type: "boolean" },
          acceptableAnswers: { type: "array", items: { type: "string" } },
          modelAnswer: { type: "string" },
          rubric: { type: "string" },
          explanation: { type: "string" },
        },
      },
    },
  },
} as const;

export const SCHEMA_LONG = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "text", "modelAnswer", "rubric", "explanation"],
        properties: {
          type: { type: "string", enum: ["long_answer"] },
          text: { type: "string" },
          modelAnswer: { type: "string" },
          rubric: { type: "string" },
          explanation: { type: "string" },
        },
      },
    },
  },
} as const;
