// @ts-nocheck - Deno runtime, not Node/browser TS
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: starter } = await supabase
      .from("plans")
      .select("id")
      .eq("slug", "enterprise_starter")
      .maybeSingle();

    const { data: fallback } = await supabase
      .from("plans")
      .select("id, slug")
      .eq("slug", "enterprise_free")
      .maybeSingle();

    const { data: individualFallback } = fallback?.id
      ? { data: null }
      : await supabase
          .from("plans")
          .select("id, slug")
          .eq("slug", "individual_starter")
          .maybeSingle();

    const targetPlan = fallback ?? individualFallback;
    if (!starter?.id || !targetPlan?.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing enterprise_starter or free fallback plan" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: expiredUsage, error: usageError } = await supabase
      .from("trial_ai_usage")
      .select("user_id")
      .lt("trial_end", new Date().toISOString());

    if (usageError) throw usageError;

    const expiredUserIds = [...new Set((expiredUsage ?? []).map((row) => row.user_id).filter(Boolean))];
    if (expiredUserIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, expired_count: 0, fallback_plan: targetPlan.slug }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("user_subscriptions")
      .update({
        plan_id: targetPlan.id,
        status: "active",
        expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("plan_id", starter.id)
      .eq("status", "active")
      .in("user_id", expiredUserIds)
      .select("user_id");

    if (updateError) throw updateError;

    const expiredCount = updated?.length ?? 0;
    console.log(`expire-trials: ${expiredCount} trial(s) expired to ${targetPlan.slug}`);

    return new Response(
      JSON.stringify({ success: true, expired_count: expiredCount, fallback_plan: targetPlan.slug }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
