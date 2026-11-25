import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ForbiddenError, requirePermission } from "@/server/auth-guard";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, saveFile } from "@/server/services/storage";
import { clientIdFor } from "@/server/services/attachments";
import { activity, audit } from "@/server/services/audit";

const metaSchema = z.object({
  entityType: z.enum(["CLIENT", "CONTRACT", "REQUEST", "QUOTATION"]),
  entityId: z.string().min(1),
  label: z.string().trim().max(120).optional(),
});

/** Upload an attachment (multipart/form-data: file, entityType, entityId, label?). */
export async function POST(req: Request) {
  try {
    const user = await requirePermission("write");
    const form = await req.formData();
    const meta = metaSchema.safeParse({
      entityType: form.get("entityType"),
      entityId: form.get("entityId"),
      label: form.get("label") || undefined,
    });
    const file = form.get("file");
    if (!meta.success || !(file instanceof File)) return NextResponse.json({ error: "validation.invalid" }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "files.tooLarge" }, { status: 413 });
    if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "files.badType" }, { status: 415 });

    const clientId = await clientIdFor(meta.data.entityType, meta.data.entityId);
    if (!clientId) return NextResponse.json({ error: "errors.notFound" }, { status: 404 });

    const stored = await saveFile(
      `${meta.data.entityType.toLowerCase()}/${meta.data.entityId}`,
      file.name,
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );
    const att = await db.$transaction(async (tx) => {
      const a = await tx.attachment.create({
        data: {
          ...meta.data,
          url: stored.url,
          pathname: stored.pathname,
          filename: file.name,
          contentType: file.type,
          size: file.size,
          uploadedById: user.id,
        },
      });
      await audit(tx, { actorId: user.id, action: "CREATE", entity: "Attachment", entityId: a.id, after: a });
      await activity(tx, {
        clientId,
        type: "attachment.added",
        summary: file.name,
        refType: meta.data.entityType.toLowerCase(),
        refId: meta.data.entityId,
        actorId: user.id,
      });
      return a;
    });
    return NextResponse.json({ id: att.id });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: "auth.forbidden" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "common.error" }, { status: 500 });
  }
}
