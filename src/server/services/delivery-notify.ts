import "server-only";
import { after } from "next/server";
import { db } from "@/lib/db";
import { todayUTC } from "@/lib/format";
import { eventRecipients, type TaskEventKind } from "@/lib/notifications/task-events";
import { getSettings } from "./settings";
import { emailPending, type NotificationMeta } from "./notifications";

/**
 * Task event notifications (assigned, delivered, due date changed, mention).
 * Creates in-app notifications right away; emails go out after the response
 * is sent (Settings → "Also email reminders") so the user isn't kept waiting.
 * Staff only — clients are never notified.
 */
export async function notifyTaskEvent(
  kind: TaskEventKind,
  taskId: string,
  opts: { actorId?: string; userIds?: string[]; ref?: string; meta?: Omit<NotificationMeta, "actorName"> } = {},
) {
  try {
    const task = await db.deliveryTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        dueDate: true,
        assignees: { select: { userId: true, role: true } },
        watchers: { select: { userId: true } },
        project: { select: { client: { select: { id: true, accountManagerId: true } } } },
      },
    });
    if (!task) return;
    const people = { assignees: task.assignees, watchers: task.watchers.map((w) => w.userId), accountManagerId: task.project.client.accountManagerId };
    const candidates = eventRecipients(kind, people, opts);
    if (!candidates.length) return;
    const [active, actor] = await Promise.all([
      db.user.findMany({ where: { id: { in: candidates }, active: true }, select: { id: true } }),
      opts.actorId ? db.user.findUnique({ where: { id: opts.actorId }, select: { name: true } }) : null,
    ]);
    if (!active.length) return;
    const ref = opts.ref ?? new Date().toISOString();
    const meta = { ...opts.meta, actorName: actor?.name };
    await db.notification.createMany({
      data: active.map((u) => ({
        userId: u.id,
        kind,
        entityType: "task",
        entityId: task.id,
        clientId: task.project.client.id,
        dueDate: task.dueDate ?? todayUTC(),
        daysBefore: 0,
        triggerKey: `task:${task.id}:${kind}:${ref}`,
        meta,
      })),
      skipDuplicates: true,
    });
    const settings = await getSettings();
    if (!settings.notifyByEmail) return;
    const ids = (
      await db.notification.findMany({ where: { entityId: task.id, kind, triggerKey: `task:${task.id}:${kind}:${ref}`, emailedAt: null }, select: { id: true } })
    ).map((n) => n.id);
    if (ids.length)
      after(async () => {
        const r = await emailPending({ id: { in: ids } });
        if (r.errors.length) console.error("task notification email failed", r.errors);
      });
  } catch (e) {
    // Notifications must never break the action that triggered them.
    console.error("notifyTaskEvent failed", e);
  }
}
