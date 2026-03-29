import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { stripe, getOrCreateStripeCustomer } from "@/lib/stripe";
import { z } from "zod";

const bodySchema = z.object({
  workspaceId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { workspaceId } = parsed.data;

    // Verify user is owner of this workspace
    const membership = await db.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: session.user.id,
        status: "ACTIVE",
        role: "OWNER",
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const email = session.user.email!;
    const customerId = await getOrCreateStripeCustomer(workspaceId, email);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXTAUTH_URL}/settings/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("[POST /api/billing/portal]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
