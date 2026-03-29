import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseISO } from "date-fns";
import { type BulkRow, validateBulkRow } from "@/lib/bulk-upload";

// POST /api/posts/bulk
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const validateOnly = searchParams.get("validate") === "true";

    const body = await request.json();
    const {
      workspaceId,
      rows,
      skipErrors = false,
    } = body as {
      workspaceId: string;
      rows: BulkRow[];
      skipErrors?: boolean;
    };

    if (!workspaceId || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: "Missing required fields: workspaceId, rows" },
        { status: 400 }
      );
    }

    if (rows.length > 200) {
      return NextResponse.json(
        { error: "Maximum 200 rows per upload" },
        { status: 400 }
      );
    }

    const membership = await db.workspaceMember.findFirst({
      where: { workspaceId, userId: session.user.id, status: "ACTIVE" },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get connected platforms for validation
    const connectedAccounts = await db.socialAccount.findMany({
      where: { workspaceId, status: "ACTIVE" },
      select: { platform: true, id: true },
    });
    const connectedPlatforms = connectedAccounts.map((a) => a.platform as string);

    // Validate all rows
    const validations = rows.map((row, index) => ({
      index,
      row,
      result: validateBulkRow(row as unknown as Record<string, string>, connectedPlatforms),
    }));

    if (validateOnly) {
      return NextResponse.json({ validations });
    }

    // Separate valid/invalid
    const toCreate = validations.filter(
      (v) => v.result.valid || (skipErrors && v.result.warnings.length > 0 && v.result.errors.length === 0)
    );
    const skipped = validations.filter(
      (v) => !v.result.valid && (!skipErrors || v.result.errors.length > 0)
    );

    // Build post data
    const postsData = toCreate.map(({ row }) => {
      const scheduledAt = parseISO(row.scheduled_at);
      return {
        workspaceId,
        content: row.content,
        scheduledAt,
        firstComment: row.first_comment ?? null,
        status: "SCHEDULED" as const,
        metadata: {
          mediaUrl: row.media_url ?? null,
          labels: row.labels
            ? row.labels.split(";").map((l) => l.trim()).filter(Boolean)
            : [],
          bulkImported: true,
        },
      };
    });

    // Create all posts (createMany doesn't support nested relations)
    let created = 0;
    const createErrors: Array<{ index: number; error: string }> = [];

    for (const { index, row } of toCreate) {
      try {
        const scheduledAt = parseISO(row.scheduled_at);
        const platformList = row.platforms
          .split(";")
          .map((p) => p.trim().toUpperCase())
          .filter(Boolean);

        // Find matching social account IDs
        const accountIds = connectedAccounts
          .filter((a) => platformList.includes(a.platform as string))
          .map((a) => a.id);

        await db.post.create({
          data: {
            workspaceId,
            content: row.content,
            scheduledAt,
            firstComment: row.first_comment || null,
            status: "SCHEDULED",
            metadata: {
              mediaUrl: row.media_url || null,
              bulkImported: true,
            },
            accounts: accountIds.length
              ? {
                  create: accountIds.map((socialAccountId) => ({
                    socialAccountId,
                    status: "SCHEDULED",
                  })),
                }
              : undefined,
          },
        });
        created++;
      } catch (err) {
        createErrors.push({
          index,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      created,
      skipped: skipped.length,
      errors: [
        ...skipped.map(({ index, result }) => ({
          index,
          errors: result.errors,
          warnings: result.warnings,
        })),
        ...createErrors,
      ],
    });
  } catch (error) {
    console.error("[POST /api/posts/bulk]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
