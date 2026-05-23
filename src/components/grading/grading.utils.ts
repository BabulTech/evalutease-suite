import Anthropic from "@anthropic-ai/sdk";

export function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("AI grading is not configured: ANTHROPIC_API_KEY missing.");
  return new Anthropic({ apiKey });
}

type RawItem = { id?: string; points?: number; comment?: string; reasoning?: string };

/** Parse a Claude response that must be a JSON array, with markdown-fence fallback. */
export function parseBatchJson(raw: string): RawItem[] {
  const tryParse = (s: string): RawItem[] | null => {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  };

  return (
    tryParse(raw) ??
    tryParse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")) ??
    (() => {
      const start = raw.indexOf("[");
      const end = raw.lastIndexOf("]");
      return start >= 0 && end > start ? tryParse(raw.slice(start, end + 1)) : null;
    })() ??
    (() => {
      throw new Error("Could not parse AI batch grading response");
    })()
  );
}
