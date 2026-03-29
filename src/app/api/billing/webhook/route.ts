import { NextRequest, NextResponse } from "next/server";
import { stripe, getPlanFromPriceId } from "@/lib/stripe";
import { db } from "@/lib/db";
import type Stripe from "stripe";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[Webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCreated(subscription);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const workspaceId = subscription.metadata?.workspaceId;
  if (!workspaceId) {
    console.warn("[Webhook] subscription.created missing workspaceId metadata");
    return;
  }

  // Idempotency: skip if already recorded this subscription
  const existing = await db.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (existing) return;

  const priceId = subscription.items.data[0]?.price?.id ?? "";
  const plan = getPlanFromPriceId(priceId);

  await db.subscription.upsert({
    where: { workspaceId },
    update: {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      stripePriceId: priceId,
      plan: plan as "STARTER" | "PRO" | "PRO_PLUS" | "FREE",
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
    },
    create: {
      workspaceId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      stripePriceId: priceId,
      plan: plan as "STARTER" | "PRO" | "PRO_PLUS" | "FREE",
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
    },
  });

  // Update workspace plan
  await db.workspace.update({
    where: { id: workspaceId },
    data: { plan: plan as "STARTER" | "PRO" | "PRO_PLUS" | "FREE" },
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const workspaceId = subscription.metadata?.workspaceId;
  if (!workspaceId) {
    console.warn("[Webhook] subscription.updated missing workspaceId metadata");
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id ?? "";
  const plan = getPlanFromPriceId(priceId);

  await db.subscription.upsert({
    where: { workspaceId },
    update: {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      stripePriceId: priceId,
      plan: plan as "STARTER" | "PRO" | "PRO_PLUS" | "FREE",
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
    },
    create: {
      workspaceId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      stripePriceId: priceId,
      plan: plan as "STARTER" | "PRO" | "PRO_PLUS" | "FREE",
      status: mapStripeStatus(subscription.status),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
    },
  });

  // Sync plan to workspace
  await db.workspace.update({
    where: { id: workspaceId },
    data: { plan: plan as "STARTER" | "PRO" | "PRO_PLUS" | "FREE" },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const workspaceId = subscription.metadata?.workspaceId;
  if (!workspaceId) {
    console.warn("[Webhook] subscription.deleted missing workspaceId metadata");
    return;
  }

  await db.subscription.upsert({
    where: { workspaceId },
    update: {
      status: "CANCELED",
      cancelAtPeriodEnd: false,
    },
    create: {
      workspaceId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      plan: "FREE",
      status: "CANCELED",
    },
  });

  await db.workspace.update({
    where: { id: workspaceId },
    data: { plan: "FREE" },
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  if (!customerId) return;

  // Find workspace via stripe customer id
  const subscription = await db.subscription.findFirst({
    where: { stripeCustomerId: customerId },
    include: { workspace: { include: { owner: true } } },
  });

  if (!subscription) return;

  // Idempotency: only update if not already PAST_DUE
  if (subscription.status !== "PAST_DUE") {
    await db.subscription.update({
      where: { id: subscription.id },
      data: { status: "PAST_DUE" },
    });
  }

  // Send email notification (fire-and-forget)
  if (subscription.workspace.owner?.email) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "PostSyncer <billing@postsyncer.com>",
        to: subscription.workspace.owner.email,
        subject: "Payment failed — please update your payment method",
        html: `
          <p>Hi ${subscription.workspace.owner.name ?? "there"},</p>
          <p>We were unable to process your payment for your PostSyncer subscription.</p>
          <p>Please update your payment method to continue using PostSyncer without interruption.</p>
          <p><a href="${process.env.NEXTAUTH_URL}/settings/billing">Update payment method</a></p>
          <p>If you need help, reply to this email.</p>
        `,
      });
    } catch (emailError) {
      console.error("[Webhook] Failed to send payment failed email:", emailError);
    }
  }
}

function mapStripeStatus(
  status: Stripe.Subscription.Status
): "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "PAUSED" | "UNPAID" {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "paused":
      return "PAUSED";
    case "unpaid":
      return "UNPAID";
    default:
      return "ACTIVE";
  }
}
