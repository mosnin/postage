import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's primary workspace (owner)
    const membership = await db.workspaceMember.findFirst({
      where: {
        userId: session.user.id,
        status: "ACTIVE",
        role: "OWNER",
      },
      include: {
        workspace: {
          include: {
            subscription: true,
            socialAccounts: { where: { status: "ACTIVE" } },
            mediaFiles: { select: { size: true } },
            settings: { select: { aiCreditsUsed: true } },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    if (!membership) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { workspace } = membership;
    const subscription = workspace.subscription;

    // Compute usage
    const accountsUsed = workspace.socialAccounts.length;
    const workspacesUsed = await db.workspace.count({
      where: { ownerId: session.user.id },
    });
    const storageUsedBytes = workspace.mediaFiles.reduce(
      (sum, f) => sum + f.size,
      0
    );
    const aiCreditsUsed = workspace.settings?.aiCreditsUsed ?? 0;

    // Fetch invoices from Stripe (or return empty in dev/test)
    let invoices: {
      id: string;
      date: string;
      description: string;
      amount: number;
      currency: string;
      status: string;
      invoiceUrl: string | null;
    }[] = [];

    if (
      subscription?.stripeCustomerId &&
      process.env.STRIPE_SECRET_KEY &&
      !process.env.STRIPE_SECRET_KEY.startsWith("sk_test_placeholder")
    ) {
      try {
        const stripeInvoices = await stripe.invoices.list({
          customer: subscription.stripeCustomerId,
          limit: 12,
        });

        invoices = stripeInvoices.data.map((inv) => ({
          id: inv.id,
          date: new Date(inv.created * 1000).toISOString(),
          description: inv.lines.data[0]?.description ?? "Subscription",
          amount: inv.amount_paid,
          currency: inv.currency,
          status: inv.status ?? "unknown",
          invoiceUrl: inv.invoice_pdf ?? null,
        }));
      } catch (stripeError) {
        console.warn("[billing/data] Could not fetch Stripe invoices:", stripeError);
      }
    }

    return NextResponse.json({
      workspaceId: workspace.id,
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
            currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            stripeCustomerId: subscription.stripeCustomerId,
          }
        : null,
      usage: {
        accountsUsed,
        workspacesUsed,
        aiCreditsUsed,
        storageUsedBytes,
      },
      invoices,
    });
  } catch (error) {
    console.error("[GET /api/billing/data]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
