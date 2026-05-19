import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ActivityInput = {
  actorUserId: string;
  planOwnerId?: string | null;
  actionType: string;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  message: string;
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  riskScore?: number;
};

type AiUsageInput = {
  actorUserId: string;
  planOwnerId: string;
  feature: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  creditsCharged?: number;
  requestStatus?: "success" | "failed" | "blocked";
  latencyMs?: number;
  details?: Record<string, unknown>;
};

type AlertInput = {
  severity: "low" | "medium" | "high" | "critical";
  alertType: string;
  actorUserId?: string | null;
  planOwnerId?: string | null;
  title: string;
  message: string;
  details?: Record<string, unknown>;
};

async function getProfile(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

export async function logActivity(input: ActivityInput) {
  try {
    const profile = await getProfile(input.actorUserId);
    const actorName =
      profile?.full_name ||
      profile?.email?.split("@")[0] ||
      "Unknown user";

    await (supabaseAdmin as any).from("activity_logs").insert({
      actor_user_id: input.actorUserId,
      actor_name: actorName,
      actor_email: profile?.email ?? null,
      plan_owner_id: input.planOwnerId ?? input.actorUserId,
      action_type: input.actionType,
      module: input.module,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      entity_label: input.entityLabel ?? null,
      message: input.message,
      details: input.details ?? {},
      metadata: input.metadata ?? {},
      risk_score: Math.max(0, Math.min(100, input.riskScore ?? 0)),
    });
  } catch (error) {
    console.warn("Audit activity logging failed", error);
  }
}

async function createSecurityAlert(input: AlertInput) {
  try {
    await (supabaseAdmin as any).from("security_alerts").insert({
      severity: input.severity,
      alert_type: input.alertType,
      actor_user_id: input.actorUserId ?? null,
      plan_owner_id: input.planOwnerId ?? input.actorUserId ?? null,
      title: input.title,
      message: input.message,
      details: input.details ?? {},
    });
  } catch (error) {
    console.warn("Security alert logging failed", error);
  }
}

async function estimateAiCost(model: string, inputTokens: number, outputTokens: number) {
  const { data } = await (supabaseAdmin as any)
    .from("ai_model_pricing")
    .select("input_cost_per_million, output_cost_per_million, currency")
    .eq("provider", "anthropic")
    .eq("model", model)
    .eq("is_active", true)
    .maybeSingle();

  const inputRate = Number(data?.input_cost_per_million ?? 0);
  const outputRate = Number(data?.output_cost_per_million ?? 0);
  const cost = (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate;
  return {
    cost: Number(cost.toFixed(6)),
    currency: data?.currency ?? "USD",
  };
}

async function runAiAlertRules(input: AiUsageInput, estimatedCost: number) {
  if (input.requestStatus && input.requestStatus !== "success") return;

  const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ count: hourCalls }, { count: dayCalls }] = await Promise.all([
    (supabaseAdmin as any)
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("plan_owner_id", input.planOwnerId)
      .gte("created_at", sinceHour),
    (supabaseAdmin as any)
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("plan_owner_id", input.planOwnerId)
      .gte("created_at", sinceDay),
  ]);

  const callsLastHour = hourCalls ?? 0;
  const callsLastDay = dayCalls ?? 0;

  if (callsLastHour >= 10) {
    await createSecurityAlert({
      severity: callsLastHour >= 20 ? "high" : "medium",
      alertType: "ai_overuse_hourly",
      actorUserId: input.actorUserId,
      planOwnerId: input.planOwnerId,
      title: "Unusual AI usage in one hour",
      message: `${callsLastHour} AI calls were made by this organization in the last hour.`,
      details: { feature: input.feature, calls_last_hour: callsLastHour },
    });
  }

  if (callsLastDay >= 50) {
    await createSecurityAlert({
      severity: callsLastDay >= 100 ? "critical" : "high",
      alertType: "ai_overuse_daily",
      actorUserId: input.actorUserId,
      planOwnerId: input.planOwnerId,
      title: "High daily AI usage",
      message: `${callsLastDay} AI calls were made by this organization in the last 24 hours.`,
      details: { feature: input.feature, calls_last_day: callsLastDay },
    });
  }

  if ((input.creditsCharged ?? 0) >= 20 || estimatedCost >= 1) {
    await createSecurityAlert({
      severity: "medium",
      alertType: "ai_cost_spike",
      actorUserId: input.actorUserId,
      planOwnerId: input.planOwnerId,
      title: "AI cost spike",
      message: `One AI request used ${input.inputTokens ?? 0} input tokens and ${input.outputTokens ?? 0} output tokens.`,
      details: {
        feature: input.feature,
        estimated_cost: estimatedCost,
        credits_charged: input.creditsCharged ?? 0,
      },
    });
  }
}

export async function logAiUsage(input: AiUsageInput) {
  try {
    const inputTokens = Math.max(0, input.inputTokens ?? 0);
    const outputTokens = Math.max(0, input.outputTokens ?? 0);
    const { cost, currency } = await estimateAiCost(input.model, inputTokens, outputTokens);

    await (supabaseAdmin as any).from("ai_usage_logs").insert({
      actor_user_id: input.actorUserId,
      plan_owner_id: input.planOwnerId,
      feature: input.feature,
      provider: "anthropic",
      model: input.model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost: cost,
      currency,
      credits_charged: input.creditsCharged ?? 0,
      request_status: input.requestStatus ?? "success",
      latency_ms: input.latencyMs ?? null,
      details: input.details ?? {},
    });

    await logActivity({
      actorUserId: input.actorUserId,
      planOwnerId: input.planOwnerId,
      actionType: "generated",
      module: "ai",
      entityType: "ai_request",
      entityLabel: input.feature,
      message: `AI ${input.feature} used ${inputTokens + outputTokens} tokens`,
      details: {
        feature: input.feature,
        model: input.model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost: cost,
        credits_charged: input.creditsCharged ?? 0,
        status: input.requestStatus ?? "success",
        ...(input.details ?? {}),
      },
      riskScore: cost >= 1 ? 60 : (input.creditsCharged ?? 0) >= 20 ? 50 : 10,
    });

    await runAiAlertRules(input, cost);
  } catch (error) {
    console.warn("AI usage logging failed", error);
  }
}
