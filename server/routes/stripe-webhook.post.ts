import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

function getAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function upsertSub(sub: Stripe.Subscription, db: ReturnType<typeof getAdmin>) {
  const userId = sub.metadata?.supabase_user_id;
  if (!userId) return;
  const planSlug = sub.metadata?.plan_slug ?? "free";
  const { data: plan } = await db.from("plans").select("id").eq("slug", planSlug).maybeSingle();
  if (!plan) return;

  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  await db.from("user_subscriptions").upsert({
    user_id: userId,
    plan_id: (plan as { id: string }).id,
    stripe_subscription_id: sub.id,
    stripe_customer_id: sub.customer as string,
    status: sub.status,
    current_period_end: periodEnd,
  } as never, { onConflict: "user_id" });
}

async function revertToFree(sub: Stripe.Subscription, db: ReturnType<typeof getAdmin>) {
  const userId = sub.metadata?.supabase_user_id;
  if (!userId) return;
  const { data: freePlan } = await db.from("plans").select("id").eq("slug", "free").maybeSingle();
  if (!freePlan) return;
  await db.from("user_subscriptions").upsert({
    user_id: userId,
    plan_id: (freePlan as { id: string }).id,
    stripe_subscription_id: sub.id,
    stripe_customer_id: sub.customer as string,
    status: "canceled",
    current_period_end: null,
  } as never, { onConflict: "user_id" });
}

export default defineEventHandler(async (event) => {
  const stripe = getStripe();
  const db = getAdmin();
  const sig = getHeader(event, "stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const body = await readRawBody(event, false);

  let stripeEvent: Stripe.Event;
  if (webhookSecret && sig && body) {
    try {
      stripeEvent = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch {
      setResponseStatus(event, 400);
      return "Webhook signature invalid";
    }
  } else {
    stripeEvent = JSON.parse(body?.toString() ?? "{}") as Stripe.Event;
  }

  switch (stripeEvent.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertSub(stripeEvent.data.object as Stripe.Subscription, db);
      break;
    case "customer.subscription.deleted":
      await revertToFree(stripeEvent.data.object as Stripe.Subscription, db);
      break;
    case "checkout.session.completed": {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        if (!sub.metadata?.supabase_user_id && session.metadata?.supabase_user_id) {
          await stripe.subscriptions.update(sub.id, { metadata: session.metadata });
          await upsertSub({ ...sub, metadata: session.metadata }, db);
        } else {
          await upsertSub(sub, db);
        }
      }
      break;
    }
  }

  return "ok";
});
