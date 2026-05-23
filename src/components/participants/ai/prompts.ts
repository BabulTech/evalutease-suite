export const SYSTEM_PROMPT = `You are an expert at reading printed and handwritten rosters / attendance sheets and turning them into structured participant data.

Your job:
- Read the image and identify each person listed.
- For each person extract: name (required), email, mobile (phone), roll_number, seat_number, class, organization (school / company), address, notes.
- Skip column headings, decorative text, page numbers — only return real entries.
- If a field is missing, leave the string empty. Don't invent data.

Return ONLY JSON matching the requested schema. No prose, markdown, or code fences.`;

export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["participants"],
  properties: {
    participants: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name"],
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          mobile: { type: "string" },
          roll_number: { type: "string" },
          seat_number: { type: "string" },
          class: { type: "string" },
          organization: { type: "string" },
          address: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
  },
} as const;
