import { supabase } from "@/integrations/supabase/client";

type ClientActivityInput = {
  actionType: string;
  module: string;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  message: string;
  details?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  planOwnerId?: string | null;
  riskScore?: number;
};

export async function logClientActivity(input: ClientActivityInput) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not yet in generated Supabase types
    await (supabase as any).rpc("log_activity", {
      p_action_type: input.actionType,
      p_module: input.module,
      p_entity_type: input.entityType ?? null,
      p_entity_id: input.entityId ?? null,
      p_entity_label: input.entityLabel ?? null,
      p_message: input.message,
      p_details: input.details ?? {},
      p_metadata: input.metadata ?? {},
      p_plan_owner_id: input.planOwnerId ?? null,
      p_risk_score: input.riskScore ?? 0,
    });
  } catch (error) {
    console.warn("Activity logging failed", error);
  }
}
