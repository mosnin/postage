import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export const STRIPE_PLANS = {
  STARTER_MONTHLY: process.env.STRIPE_STARTER_PRICE_ID!,
  STARTER_ANNUAL: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID!,
  PRO_MONTHLY: process.env.STRIPE_PRO_PRICE_ID!,
  PRO_ANNUAL: process.env.STRIPE_PRO_ANNUAL_PRICE_ID!,
  PRO_PLUS_MONTHLY: process.env.STRIPE_PRO_PLUS_PRICE_ID!,
  PRO_PLUS_ANNUAL: process.env.STRIPE_PRO_PLUS_ANNUAL_PRICE_ID!,
};

export const PLAN_PRICES = {
  STARTER: { monthly: 19, annual: 15 },
  PRO: { monthly: 49, annual: 39 },
  PRO_PLUS: { monthly: 99, annual: 79 },
};

export async function getOrCreateStripeCustomer(
  workspaceId: string,
  email: string
): Promise<string> {
  const { db } = await import("@/lib/db");

  const subscription = await db.subscription.findUnique({
    where: { workspaceId },
  });

  if (subscription?.stripeCustomerId) {
    return subscription.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: { workspaceId },
  });

  await db.subscription.upsert({
    where: { workspaceId },
    update: { stripeCustomerId: customer.id },
    create: {
      workspaceId,
      stripeCustomerId: customer.id,
      plan: "STARTER",
      status: "TRIALING",
    },
  });

  return customer.id;
}

export function getPlanFromPriceId(priceId: string): string {
  const map: Record<string, string> = {
    [process.env.STRIPE_STARTER_PRICE_ID ?? ""]: "STARTER",
    [process.env.STRIPE_STARTER_ANNUAL_PRICE_ID ?? ""]: "STARTER",
    [process.env.STRIPE_PRO_PRICE_ID ?? ""]: "PRO",
    [process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? ""]: "PRO",
    [process.env.STRIPE_PRO_PLUS_PRICE_ID ?? ""]: "PRO_PLUS",
    [process.env.STRIPE_PRO_PLUS_ANNUAL_PRICE_ID ?? ""]: "PRO_PLUS",
  };
  return map[priceId] ?? "STARTER";
}
