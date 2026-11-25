"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/server/auth-guard";
import { runAction } from "@/server/action-result";
import { deleteFile } from "@/server/services/storage";
import { audit } from "@/server/services/audit";

export async function deleteAttachmentAction(id: string, revalidate: string) {
  return runAction(async () => {
    const user = await requirePermission("delete");
    const att = await db.attachment.findUniqueOrThrow({ where: { id } });
    await db.$transaction(async (tx) => {
      await tx.attachment.delete({ where: { id } });
      await audit(tx, { actorId: user.id, action: "DELETE", entity: "Attachment", entityId: id, before: att });
    });
    await deleteFile(att.url).catch((e) => console.error("blob delete failed", e));
    revalidatePath(revalidate);
  });
}
