import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type PlanSlug = "individual_starter" | "enterprise_free";

type EnsurePlanInput = {
  planSlug: PlanSlug;
  _token: string;
  isNgo?: boolean;
};

const VALID_PLANS = new Set(["individual_starter", "enterprise_free"]);

async function getUserIdFromToken(token: string): Promise<string> {
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user?.id) throw new Error("Unauthorized");
  return userData.user.id;
}

export async function resolvePlanOwnerId(userId: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any)
    .from("company_members")
    .select("company_profiles(admin_user_id)")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return data?.company_profiles?.admin_user_id ?? userId;
}

async function getPlanBySlug(slug: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from("plans")
    .select("id, slug")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; slug: string } | null;
}

export const ensureSelectedPlan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown): EnsurePlanInput => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid input");
    const v = data as Record<string, unknown>;
    const planSlug =
      typeof v.planSlug === "string" && VALID_PLANS.has(v.planSlug)
        ? (v.planSlug as EnsurePlanInput["planSlug"])
        : "individual_starter";
    const _token = typeof v._token === "string" ? v._token : "";
    if (!_token) throw new Error("Unauthorized");
    const isNgo = v.isNgo === true;
    return { planSlug, _token, isNgo };
  })
  .handler(async ({ data }): Promise<{ planSlug: string; expiresAt: string | null }> => {
    const [userId, { data: userData }, plan] = await Promise.all([
      getUserIdFromToken(data._token),
      supabaseAdmin.auth.getUser(data._token),
      getPlanBySlug(data.planSlug),
    ]);
    const user = userData.user;
    if (!plan?.id) throw new Error(`Plan not found: ${data.planSlug}`);

    const fullName =
      (user?.user_metadata?.full_name as string | undefined) ||
      [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(" ") ||
      user?.email?.split("@")[0] ||
      "User";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profileErr } = await (supabaseAdmin as any).from("profiles").upsert(
      {
        id: userId,
        email: user?.email,
        full_name: fullName,
        selected_plan: data.planSlug,
        is_ngo: data.isNgo ?? false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (profileErr) throw profileErr;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: subErr } = await (supabaseAdmin as any).from("user_subscriptions").upsert(
      {
        user_id: userId,
        plan_id: plan.id,
        status: "active",
        expires_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (subErr) throw subErr;

    // For enterprise free plan — initialise the lifetime free AI calls tracker (10 calls, no expiry)
    if (data.planSlug === "enterprise_free") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any).from("trial_ai_usage").upsert(
        {
          user_id: userId,
          used_calls: 0,
          trial_start: new Date().toISOString(),
          trial_end: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
    }

    return { planSlug: data.planSlug, expiresAt: null };
  });
