import { createServerFn } from "@tanstack/react-start";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

type CheckoutInput = {
  userId: string;
  priceId: string;
  planSlug: string;
  promoCode?: string;
  successUrl: string;
  cancelUrl: string;
};

type PortalInput = {
  userId: string;
  returnUrl: string;
};

type SyncPlanInput = {
  planId: string;
  planName: string;
  planSlug: string;
  priceMonthly: number;
  priceYearly: number;
};

// ── Auto-create Stripe prices when admin saves a plan ────────────────────────
export const syncPlanToStripe = createServerFn({ method: "POST" })
  .inputValidator((data: unknown): SyncPlanInput => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid input");
    return data as SyncPlanInput;
  })
  .handler(async (ctx) => {
    const data = ctx.data as SyncPlanInput;
    const stripe = getStripe();

    if (data.priceMonthly === 0 && data.priceYearly === 0) {
      // Free plan — no Stripe prices needed
      await supabaseAdmin.from("plans").update({
        stripe_price_id_monthly: null,
        stripe_price_id_yearly: null,
      } as never).eq("id", data.planId);
      return { monthly: null, yearly: null };
    }

    // Find or create a Stripe product for this plan slug
    const products = await stripe.products.search({
      query: `metadata['plan_slug']:'${data.planSlug}'`,
      limit: 1,
    });

    let productId: string;
    if (products.data[0]) {
      productId = products.data[0].id;
      await stripe.products.update(productId, { name: data.planName });
    } else {
      const product = await stripe.products.create({
        name: data.planName,
        metadata: { plan_slug: data.planSlug },
      });
      productId = product.id;
    }

    // Helper: find existing price or create a new one
    async function upsertPrice(amount: number, interval: "month" | "year") {
      const existing = await stripe.prices.list({
        product: productId,
        active: true,
        recurring: { interval },
        limit: 10,
      });
      const amountCents = Math.round(amount * 100);
      const match = existing.data.find((p) => p.unit_amount === amountCents);
      if (match) return match.id;

      // Archive old prices for this interval so only one is active
      for (const old of existing.data) {
        await stripe.prices.update(old.id, { active: false });
      }

      const price = await stripe.prices.create({
        product: productId,
        unit_amount: amountCents,
        currency: "usd",
        recurring: { interval },
      });
      return price.id;
    }

    const [monthlyId, yearlyId] = await Promise.all([
      data.priceMonthly > 0 ? upsertPrice(data.priceMonthly, "month") : Promise.resolve(null),
      data.priceYearly > 0  ? upsertPrice(data.priceYearly,  "year")  : Promise.resolve(null),
    ]);

    await supabaseAdmin.from("plans").update({
      stripe_price_id_monthly: monthlyId,
      stripe_price_id_yearly: yearlyId,
    } as never).eq("id", data.planId);

    return { monthly: monthlyId, yearly: yearlyId };
  });

// ── Create Stripe checkout session ──────────────────────────────────────────
export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data: unknown): CheckoutInput => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid input");
    return data as CheckoutInput;
  })
  .handler(async (ctx) => {
    const data = ctx.data as CheckoutInput;
    const stripe = getStripe();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", data.userId)
      .maybeSingle();

    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const email = authData.user?.email;

    let customerId: string | undefined = (profile as { stripe_customer_id?: string } | null)?.stripe_customer_id ?? undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email ?? undefined,
        metadata: { supabase_user_id: data.userId },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId } as never)
        .eq("id", data.userId);
    }

    const params: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: data.priceId, quantity: 1 }],
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
      metadata: { supabase_user_id: data.userId, plan_slug: data.planSlug },
      subscription_data: { metadata: { supabase_user_id: data.userId, plan_slug: data.planSlug } },
      allow_promotion_codes: !data.promoCode,
    };

    if (data.promoCode) {
      const codes = await stripe.promotionCodes.list({ code: data.promoCode, active: true, limit: 1 });
      if (codes.data[0]) params.discounts = [{ promotion_code: codes.data[0].id }];
    }

    const session = await stripe.checkout.sessions.create(params);
    return { url: session.url };
  });

// ── Create customer portal session ──────────────────────────────────────────
export const createPortalSession = createServerFn({ method: "POST" })
  .inputValidator((data: unknown): PortalInput => {
    if (typeof data !== "object" || data === null) throw new Error("Invalid input");
    return data as PortalInput;
  })
  .handler(async (ctx) => {
    const data = ctx.data as PortalInput;
    const stripe = getStripe();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", data.userId)
      .maybeSingle();

    const customerId = (profile as { stripe_customer_id?: string } | null)?.stripe_customer_id;
    if (!customerId) throw new Error("No Stripe customer found — upgrade first");

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: data.returnUrl,
    });
    return { url: session.url };
  });
