import { NextResponse } from "next/server";
import { can, getCurrentUser } from "@/server/auth-guard";
import { buildDocument, DOC_KINDS, type DocKind } from "@/server/services/documents";

/**
 * GET /api/pdf/{contract|amc|quotation}/{id}?lang=ar|en&download=1
 * Renders the document on the letterhead. Default language = client preference.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/pdf/[kind]/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (!can(user.role, "read")) return new NextResponse("Forbidden", { status: 403 });
  const { kind, id } = await ctx.params;
  if (!DOC_KINDS.includes(kind as DocKind)) return new NextResponse("Not found", { status: 404 });
  const url = new URL(req.url);
  const lang = url.searchParams.get("lang");
  const doc = await buildDocument(kind as DocKind, id, lang === "ar" || lang === "en" ? lang : undefined);
  if (!doc) return new NextResponse("Not found", { status: 404 });
  const disposition = url.searchParams.has("download") ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(doc.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
