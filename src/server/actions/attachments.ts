"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, can, ForbiddenError } from "@/server/auth-guard";
import { taskAccess } from "@/server/services/delivery";
import { runAction } from "@/server/action-result";
import { deleteFile } from "@/server/services/storage";
import { audit } from "@/server/services/audit";

export async function deleteAttachmentAction(id: string, revalidate: string) {
  return runAction(async () => {
    const user = await getCurrentUser();
    if (!user) throw new ForbiddenError();
    const att = await db.attachment.findUniqueOrThrow({ where: { id } });
    const allowed =
      att.entityType === "DELIVERY_TASK" ? !!(await taskAccess(att.entityId, user))?.canWork
      : att.entityType === "DELIVERY_PROJECT" ? can(user.role, "manageDelivery")
      : can(user.role, "delete");
    if (!allowed) throw new ForbiddenError();
    await db.$transaction(async (tx) => {
      await tx.attachment.delete({ where: { id } });
      await audit(tx, { actorId: user.id, action: "DELETE", entity: "Attachment", entityId: id, before: att });
    });
    await deleteFile(att.url).catch((e) => console.error("blob delete failed", e));
    revalidatePath(revalidate);
  });
}
