import "server-only";
import { db } from "@/lib/db";
import type { AttachmentEntity } from "@/generated/prisma/enums";

/** Resolve the client that owns an attachment target (for timeline entries). */
export async function clientIdFor(entityType: AttachmentEntity, entityId: string): Promise<string | null> {
  switch (entityType) {
    case "CLIENT":
      return (await db.client.findUnique({ where: { id: entityId }, select: { id: true } }))?.id ?? null;
    case "CONTRACT":
      return (await db.contract.findUnique({ where: { id: entityId }, select: { clientId: true } }))?.clientId ?? null;
    case "REQUEST":
      return (await db.clientRequest.findUnique({ where: { id: entityId }, select: { clientId: true } }))?.clientId ?? null;
    case "QUOTATION":
      return (await db.quotation.findUnique({ where: { id: entityId }, select: { clientId: true } }))?.clientId ?? null;
    default:
      return null;
  }
}

export function listAttachments(entityType: AttachmentEntity, entityId: string) {
  return db.attachment.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { name: true } } },
  });
}
