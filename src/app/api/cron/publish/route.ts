// ─── Cron: Publish Due Posts ──────────────────────────────────────────────────
// Vercel Cron job — runs every minute (configured in vercel.json).
// Only callable with the correct CRON_SECRET Authorization header.

import { publishDuePosts } from "@/lib/scheduler/publish-engine";

export const runtime = "nodejs";
// Increase max duration so long-running publish batches don't time out.
export const maxDuration = 60;

export async function GET(request: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Run engine ──────────────────────────────────────────────────────────────
  const startedAt = Date.now();
  console.log("[cron/publish] Starting publish run at", new Date().toISOString());

  let results;
  try {
    results = await publishDuePosts();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/publish] Unhandled error:", message);
    return Response.json(
      { error: "Internal server error", detail: message },
      { status: 500 }
    );
  }

  const durationMs = Date.now() - startedAt;
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(
    `[cron/publish] Done in ${durationMs}ms — ` +
      `${results.length} attempts, ${succeeded} succeeded, ${failed} failed.`
  );

  return Response.json({
    ok: true,
    durationMs,
    published: succeeded,
    failed,
    total: results.length,
    results,
  });
}
