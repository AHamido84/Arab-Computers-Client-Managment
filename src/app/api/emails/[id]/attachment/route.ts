import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth-guard";
import { readFile } from "@/server/services/storage";

/** Download the exact PDF that was attached to a logged email. */
export async function GET(_req: Request, ctx: RouteContext<"/api/emails/[id]/attachment">) {
  if (!(await getCurrentUser())) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const log = await db.emailLog.findUnique({ where: { id } });
  if (!log?.attachmentUrl) return new NextResponse("Not found", { status: 404 });
  const f = await readFile(log.attachmentUrl);
  if (!f) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(f.body as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(log.attachmentName ?? "attachment.pdf")}`,
      "Cache-Control": "private, no-store",
    },
  });
}
