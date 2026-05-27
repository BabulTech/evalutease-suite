import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    throw new Error("AI generation is not configured: ANTHROPIC_API_KEY is missing on the server.");
  return new Anthropic({ apiKey });
}

export async function getUserPlanCosts(planOwnerId: string): Promise<{
  costPer10q: number;
  costScan: number;
  costByKind: Record<string, number>;
}> {
  const { data } = await supabaseAdmin
    .from("user_subscriptions")
    .select(
      "plans(credit_cost_ai_10q, credit_cost_ai_scan, credit_cost_ai_tf_10q, credit_cost_ai_short_10q, credit_cost_ai_long_10q, credit_cost_ai_mix_10q)",
    )
    .eq("user_id", planOwnerId)
    .eq("status", "active")
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plan = (data as any)?.plans;
  const mcq10q = plan?.credit_cost_ai_10q ?? 3;
  return {
    costPer10q: mcq10q,
    costScan: plan?.credit_cost_ai_scan ?? 2,
    costByKind: {
      mcq: mcq10q,
      true_false: plan?.credit_cost_ai_tf_10q ?? mcq10q,
      short_answer: plan?.credit_cost_ai_short_10q ?? Math.max(mcq10q * 1.5, 5),
      long_answer: plan?.credit_cost_ai_long_10q ?? Math.max(mcq10q * 3, 10),
      mix: plan?.credit_cost_ai_mix_10q ?? Math.max(mcq10q * 2, 6),
    },
  };
}

/** Consume one free lifetime AI call for enterprise free plan. Throws if limit reached. */
export async function consumeFreeAiCall(planOwnerId: string, freeLimit: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: usageRow, error: usageErr } = await (supabaseAdmin as any)
    .from("trial_ai_usage")
    .select("used_calls")
    .eq("user_id", planOwnerId)
    .maybeSingle();

  if (usageErr) {
    // Fail closed — don't let users generate AI for free if we can't read the limit.
    throw new Error("Could not verify free AI quota: " + usageErr.message);
  }
  if (!usageRow) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insErr } = await (supabaseAdmin as any).from("trial_ai_usage").insert({
      user_id: planOwnerId,
      used_calls: 1,
      trial_start: new Date().toISOString(),
      trial_end: null,
    });
    if (insErr) throw new Error("Failed to record free AI usage: " + insErr.message);
    return;
  }
  if ((usageRow.used_calls ?? 0) >= freeLimit)
    throw new Error(
      `Your ${freeLimit} complimentary AI calls have been used. Upgrade to Enterprise Pro for full AI access.`,
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (supabaseAdmin as any)
    .from("trial_ai_usage")
    .update({ used_calls: (usageRow.used_calls ?? 0) + 1, updated_at: new Date().toISOString() })
    .eq("user_id", planOwnerId);
  if (updErr) throw new Error("Failed to increment free AI usage: " + updErr.message);
}
