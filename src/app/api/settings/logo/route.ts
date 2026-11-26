import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ForbiddenError, requirePermission } from "@/server/auth-guard";
import { readFile, saveFile } from "@/server/services/storage";
import { getSettings } from "@/server/services/settings";
import { audit } from "@/server/services/audit";

const MAX = 2 * 1024 * 1024;

/** Upload the letterhead logo (PNG/JPEG, ≤ 2 MB). Used on every PDF. */
export async function POST(req: Request) {
  try {
    const user = await requirePermission("manageSettings");
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "validation.invalid" }, { status: 400 });
    if (file.size > MAX) return NextResponse.json({ error: "settings.logoTooLarge" }, { status: 413 });
    if (!["image/png", "image/jpeg"].includes(file.type)) return NextResponse.json({ error: "settings.logoType" }, { status: 415 });
    const stored = await saveFile("branding", file.name, Buffer.from(await file.arrayBuffer()), file.type);
    const before = await getSettings();
    await db.settings.update({ where: { id: "default" }, data: { logoUrl: stored.url } });
    await audit(db, { actorId: user.id, action: "UPDATE", entity: "Settings", entityId: "default", before: { logoUrl: before.logoUrl }, after: { logoUrl: stored.url } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "auth.forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "common.error" }, { status: 500 });
  }
}

/** Current letterhead logo (falls back to the bundled brand logo). */
export async function GET(req: Request) {
  const s = await getSettings();
  if (s.logoUrl) {
    const f = await readFile(s.logoUrl);
    if (f) return new NextResponse(f.body as BodyInit, { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=60" } });
  }
  return NextResponse.redirect(new URL("/brand/logo.png", req.url));
}
