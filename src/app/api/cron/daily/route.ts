import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runDailyJob } from "@/server/services/notifications";

export const maxDuration = 300;

/**
 * Daily job, scheduled in vercel.json (05:00 UTC). Protected by CRON_SECRET.
 * Refreshes AMC statuses, creates notifications and emails digests to staff.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const started = Date.now();
  try {
    const result = await runDailyJob();
    console.info("[cron:daily]", JSON.stringify(result));
    return NextResponse.json({ ok: true, ms: Date.now() - started, ...result });
  } catch (e) {
    console.error("[cron:daily] failed", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
