import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth-guard";
import { readFile } from "@/server/services/storage";

/** Stream a private attachment to a signed-in user. `?download=1` forces download. */
export async function GET(req: Request, ctx: RouteContext<"/api/files/[id]">) {
  if (!(await getCurrentUser())) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const att = await db.attachment.findUnique({ where: { id } });
  if (!att) return new NextResponse("Not found", { status: 404 });
  const file = await readFile(att.url);
  if (!file) return new NextResponse("Not found", { status: 404 });

  const download = new URL(req.url).searchParams.has("download");
  const inline = !download && (att.contentType === "application/pdf" || att.contentType.startsWith("image/"));
  const encoded = encodeURIComponent(att.filename);
  return new NextResponse(file.body as BodyInit, {
    headers: {
      "Content-Type": att.contentType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encoded}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
