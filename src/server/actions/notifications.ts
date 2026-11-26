"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/server/auth-guard";
import { runAction } from "@/server/action-result";
import { runDailyJob } from "@/server/services/notifications";

type Op = "read" | "unread" | "dismiss" | "restore";

/** Update one notification — always scoped to the current user. */
export async function updateNotificationAction(id: string, op: Op) {
  return runAction(async () => {
    const user = await requirePermission("read");
    const data =
      op === "read" ? { readAt: new Date() } : op === "unread" ? { readAt: null } : op === "dismiss" ? { dismissedAt: new Date(), readAt: new Date() } : { dismissedAt: null };
    await db.notification.updateMany({ where: { id, userId: user.id }, data });
    revalidatePath("/", "layout");
  });
}

export async function markAllReadAction() {
  return runAction(async () => {
    const user = await requirePermission("read");
    const r = await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    revalidatePath("/", "layout");
    return { count: r.count };
  });
}

/** Admin: run the daily check immediately (same code path as the cron job). */
export async function runDailyJobAction() {
  return runAction(async () => {
    await requirePermission("manageSettings");
    const result = await runDailyJob();
    revalidatePath("/", "layout");
    return result;
  });
}
