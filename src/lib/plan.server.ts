import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type PlanSlug = "individual_starter" | "enterprise_starter";

type EnsurePlanInput = {
  planSlug: PlanSlug;
  _token: string;
};

type TokenInput = {
  _token: string;
};

const VALID_PLANS = new Set(["individual_starter", "enterprise_starter"]);

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
    .select("id, slug, trial_days")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; slug: string; trial_days: number | null } | null;
}

async function expirePlanOwnerTrial(
  planOwnerId: string,
): Promise<{ expired: boolean; toPlanSlug: string | null }> {
  const { data: currentSub } = await supabaseAdmin
    .from("user_subscriptions")
    .select("plan_id, expires_at, plans(slug)")
    .eq("user_id", planOwnerId)
    .eq("status", "active")
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentSlug = (currentSub as any)?.plans?.slug;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expiresAt = (currentSub as any)?.expires_at as string | null;
  if (currentSlug !== "enterprise_starter" || !expiresAt || new Date(expiresAt) >= new Date()) {
    return { expired: false, toPlanSlug: null };
  }

  const fallback =
    (await getPlanBySlug("enterprise_free")) ?? (await getPlanBySlug("individual_starter"));
  if (!fallback?.id) throw new Error("No free fallback plan found");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any).from("user_subscriptions").upsert(
    {
      user_id: planOwnerId,
      plan_id: fallback.id,
      status: "active",
      expires_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { expired: true, toPlanSlug: (fallback as any).slug ?? null };
}

export const expireMyTrialIfNeeded = createServerFn({ method: "POST" })
  .inputValidator((data: unknown): TokenInput => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid input");
    const _token =
      typeof (data as Record<string, unknown>)._token === "string"
        ? ((data as Record<string, unknown>)._token as string)
        : "";
    if (!_token) throw new Error("Unauthorized");
    return { _token };
  })
  .handler(async ({ data }) => {
    const userId = await getUserIdFromToken(data._token);
    const planOwnerId = await resolvePlanOwnerId(userId);
    return expirePlanOwnerTrial(planOwnerId);
  });

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
    return { planSlug, _token };
  })
  .handler(async ({ data }): Promise<{ planSlug: string; expiresAt: string | null }> => {
    const [userId, { data: userData }, plan] = await Promise.all([
      getUserIdFromToken(data._token),
      supabaseAdmin.auth.getUser(data._token),
      getPlanBySlug(data.planSlug),
    ]);
    const user = userData.user;
    if (!plan?.id) throw new Error(`Plan not found: ${data.planSlug}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trialDays = Number((plan as any).trial_days ?? 15);
    const expiresAt =
      data.planSlug === "enterprise_starter"
        ? new Date(Date.now() + Math.max(1, trialDays) * 24 * 60 * 60 * 1000).toISOString()
        : null;

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
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (subErr) throw subErr;

    if (data.planSlug === "enterprise_starter") {
      const trialEnd = expiresAt ?? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: trialErr } = await (supabaseAdmin as any).from("trial_ai_usage").upsert(
        {
          user_id: userId,
          used_calls: 0,
          trial_start: new Date().toISOString(),
          trial_end: trialEnd,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id", ignoreDuplicates: true },
      );
      if (trialErr) throw trialErr;
    }

    return { planSlug: data.planSlug, expiresAt };
  });
