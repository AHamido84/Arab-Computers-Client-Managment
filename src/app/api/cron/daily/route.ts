import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";

/**
 * Daily job (scheduled in vercel.json).
 * Phase 5 adds: AMC status refresh, due-date notifications and admin emails.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ranAt: new Date().toISOString() });
}
