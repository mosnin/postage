import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { suggestReplies } from "@/lib/ai/openai";

const CREDIT_COST = 1;

async function checkAndDeductCredits(
  workspaceId: string,
  amount: number
): Promise<void> {
  const settings = await db.workspaceSettings.findUnique({
    where: { workspaceId },
  });

  if (!settings) {
    throw Object.assign(new Error("Workspace settings not found"), {
      status: 404,
    });
  }

  if (settings.aiCreditsUsed + amount > settings.aiCreditsLimit) {
    throw Object.assign(
      new Error(
        `Insufficient AI credits. ${settings.aiCreditsLimit - settings.aiCreditsUsed} remaining.`
      ),
      { status: 429 }
    );
  }

  await db.workspaceSettings.update({
    where: { workspaceId },
    data: { aiCreditsUsed: { increment: amount } },
  });
}

const bodySchema = z.object({
  workspaceId: z.string().min(1),
  commentText: z.string().min(1).max(2000),
  postContext: z.string().max(1000).default(""),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { workspaceId, commentText, postContext } = parsed.data;

  const membership = await db.workspaceMember.findFirst({
    where: { workspaceId, userId: session.user.id, status: "ACTIVE" },
  });
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await checkAndDeductCredits(workspaceId, CREDIT_COST);
  } catch (err: unknown) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: e.message ?? "Credit error" },
      { status: e.status ?? 500 }
    );
  }

  try {
    const suggestions = await suggestReplies(commentText, postContext);
    return NextResponse.json({ suggestions });
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.error("[suggest-reply]", e);
    await db.workspaceSettings
      .update({
        where: { workspaceId },
        data: { aiCreditsUsed: { decrement: CREDIT_COST } },
      })
      .catch(() => {});
    return NextResponse.json(
      { error: "AI generation failed. Please try again." },
      { status: 500 }
    );
  }
}
