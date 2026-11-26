"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { isDone, latestDueDate } from "@/lib/delivery";
import {
  checklistSchema,
  commentSchema,
  createProjectSchema,
  dueDateChangeSchema,
  taskManagerPatchSchema,
  taskWorkPatchSchema,
  timeLogSchema,
  updateProjectSchema,
  draftTaskSchema,
  type CreateProjectInput,
} from "@/lib/validation/delivery";
import { getCurrentUser, requirePermission } from "@/server/auth-guard";
import { DomainError, runAction } from "@/server/action-result";
import { activity, audit } from "@/server/services/audit";
import { taskAccess } from "@/server/services/delivery";
import { nextDeliveryNumber } from "@/server/services/numbering";
import { notifyTaskEvent } from "@/server/services/delivery-notify";

type Tx = Prisma.TransactionClient;

function revalidateDelivery(projectId?: string, taskId?: string) {
  revalidatePath("/delivery");
  revalidatePath("/tasks");
  revalidatePath("/my-tasks");
  if (projectId) revalidatePath(`/delivery/${projectId}`);
  if (taskId) revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/");
}

async function me() {
  const u = await getCurrentUser();
  if (!u) throw new DomainError("auth.forbidden");
  return u;
}

/** Keep project status in step with its tasks: all done → DELIVERED; reopened → ACTIVE. */
async function syncProjectStatus(tx: Tx, projectId: string) {
  const p = await tx.deliveryProject.findUniqueOrThrow({ where: { id: projectId }, include: { tasks: { select: { status: true } } } });
  const allDone = p.tasks.length > 0 && p.tasks.every((t) => isDone(t.status));
  if (allDone && p.status === "ACTIVE") {
    await tx.deliveryProject.update({ where: { id: projectId }, data: { status: "DELIVERED", deliveredAt: new Date() } });
    await activity(tx, { clientId: p.clientId, type: "delivery.delivered", summary: `${p.number} · ${p.title}`, refType: "delivery", refId: p.id });
  } else if (!allDone && p.status === "DELIVERED") {
    await tx.deliveryProject.update({ where: { id: projectId }, data: { status: "ACTIVE", deliveredAt: null } });
  }
}

const toDecimal = (v: number | null | undefined) => (v == null ? null : v);

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function createDeliveryProjectAction(input: CreateProjectInput) {
  return runAction(async () => {
    const user = await requirePermission("manageDelivery");
    const data = createProjectSchema.parse(input);

    // Validate the source and prevent duplicates.
    let quotationId: string | null = null;
    let contractId: string | null = null;
    let currency = "EGP";
    let reference = "";
    if (data.source === "QUOTATION") {
      const q = await db.quotation.findUnique({ where: { id: data.sourceId ?? "" }, include: { deliveryProjects: { select: { id: true } } } });
      if (!q || q.clientId !== data.clientId) throw new DomainError("errors.notFound");
      if (q.status !== "ACCEPTED") throw new DomainError("delivery.notApproved");
      if (q.deliveryProjects.length) throw new DomainError("delivery.alreadyExists");
      quotationId = q.id; currency = q.currency; reference = q.version > 1 ? `${q.number} v${q.version}` : q.number;
    } else if (data.source === "CONTRACT") {
      const c = await db.contract.findUnique({ where: { id: data.sourceId ?? "" }, include: { deliveryProjects: { select: { id: true } } } });
      if (!c || c.clientId !== data.clientId) throw new DomainError("errors.notFound");
      if (c.status !== "ACTIVE") throw new DomainError("delivery.notApproved");
      if (c.deliveryProjects.length) throw new DomainError("delivery.alreadyExists");
      contractId = c.id; currency = c.currency; reference = c.number;
    }

    const toIso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
    const target = data.targetDate ?? (latestDueDate(data.tasks.map((t) => ({ dueDate: toIso(t.dueDate) }))) ? new Date(`${latestDueDate(data.tasks.map((t) => ({ dueDate: toIso(t.dueDate) })))}T00:00:00Z`) : null);

    const project = await db.$transaction(async (tx) => {
      const number = await nextDeliveryNumber(tx);
      const p = await tx.deliveryProject.create({
        data: {
          number, title: data.title, clientId: data.clientId, source: data.source, quotationId, contractId,
          startDate: data.startDate, targetDate: target, notes: data.notes, createdById: user.id,
        },
      });
      for (const [i, t] of data.tasks.entries()) {
        await tx.deliveryTask.create({
          data: {
            projectId: p.id, title: t.title, scope: t.scope, price: toDecimal(t.price), currency, estimatedHours: toDecimal(t.estimatedHours),
            startDate: t.startDate, dueDate: t.dueDate, originalDueDate: t.dueDate, priority: t.priority,
            requestId: t.requestId, quotationItemId: t.quotationItemId, sortOrder: i,
            assignees: { create: t.assignees.map((a) => ({ userId: a.userId, role: a.role })) },
            watchers: { create: t.watchers.filter((w) => !t.assignees.some((a) => a.userId === w)).map((userId) => ({ userId })) },
          },
        });
      }
      await audit(tx, { actorId: user.id, action: "CREATE", entity: "DeliveryProject", entityId: p.id, after: { ...p, tasks: data.tasks.length } });
      await activity(tx, { clientId: data.clientId, type: "delivery.created", summary: `${number} · ${data.title}${reference ? ` (${reference})` : ""}`, refType: "delivery", refId: p.id, actorId: user.id });
      return p;
    });

    const tasks = await db.deliveryTask.findMany({ where: { projectId: project.id }, select: { id: true, assignees: { select: { userId: true } } } });
    for (const t of tasks) await notifyTaskEvent("TASK_ASSIGNED", t.id, { actorId: user.id, userIds: t.assignees.map((a) => a.userId) });
    revalidateDelivery(project.id);
    if (quotationId) revalidatePath(`/quotations/${quotationId}`);
    if (contractId) revalidatePath(`/contracts/${contractId}`);
    return { id: project.id };
  });
}

export async function updateProjectAction(id: string, input: unknown) {
  return runAction(async () => {
    const user = await requirePermission("manageDelivery");
    const data = updateProjectSchema.parse(input);
    await db.$transaction(async (tx) => {
      const before = await tx.deliveryProject.findUniqueOrThrow({ where: { id } });
      const after = await tx.deliveryProject.update({
        where: { id },
        data: {
          ...data,
          deliveredAt: data.status === "DELIVERED" && !before.deliveredAt ? new Date() : before.deliveredAt,
          acceptedAt: data.status === "CLIENT_ACCEPTED" ? (before.acceptedAt ?? new Date()) : null,
        },
      });
      await audit(tx, { actorId: user.id, action: "UPDATE", entity: "DeliveryProject", entityId: id, before, after });
    });
    revalidateDelivery(id);
  });
}

export async function deleteProjectAction(id: string) {
  return runAction(async () => {
    const user = await requirePermission("manageDelivery");
    const p = await db.deliveryProject.findUniqueOrThrow({ where: { id }, include: { tasks: { select: { status: true } } } });
    if (p.tasks.some((t) => isDone(t.status))) throw new DomainError("delivery.cannotDelete");
    await db.$transaction(async (tx) => {
      await tx.attachment.deleteMany({ where: { entityType: "DELIVERY_PROJECT", entityId: id } });
      await tx.deliveryProject.delete({ where: { id } });
      await audit(tx, { actorId: user.id, action: "DELETE", entity: "DeliveryProject", entityId: id, before: p });
    });
    revalidateDelivery();
  });
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function addTaskAction(projectId: string, input: unknown) {
  return runAction(async () => {
    const user = await requirePermission("manageDelivery");
    const t = draftTaskSchema.parse(input);
    const p = await db.deliveryProject.findUniqueOrThrow({ where: { id: projectId }, include: { quotation: { select: { currency: true } }, contract: { select: { currency: true } } } });
    const max = await db.deliveryTask.aggregate({ where: { projectId }, _max: { sortOrder: true } });
    const task = await db.$transaction(async (tx) => {
      const created = await tx.deliveryTask.create({
        data: {
          projectId, title: t.title, scope: t.scope, price: toDecimal(t.price), currency: p.quotation?.currency ?? p.contract?.currency ?? "EGP",
          estimatedHours: toDecimal(t.estimatedHours), startDate: t.startDate, dueDate: t.dueDate, originalDueDate: t.dueDate, priority: t.priority,
          sortOrder: (max._max.sortOrder ?? 0) + 1,
          assignees: { create: t.assignees.map((a) => ({ userId: a.userId, role: a.role })) },
          watchers: { create: t.watchers.filter((w) => !t.assignees.some((a) => a.userId === w)).map((userId) => ({ userId })) },
        },
      });
      await syncProjectStatus(tx, projectId);
      await audit(tx, { actorId: user.id, action: "CREATE", entity: "DeliveryTask", entityId: created.id, after: created });
      return created;
    });
    await notifyTaskEvent("TASK_ASSIGNED", task.id, { actorId: user.id, userIds: t.assignees.map((a) => a.userId) });
    revalidateDelivery(projectId, task.id);
    return { id: task.id };
  });
}

/**
 * Update a task. Managers can change everything below; assignees can change
 * status, progress and the delay reason only.
 */
export async function updateTaskAction(id: string, input: Record<string, unknown>) {
  return runAction(async () => {
    const user = await me();
    const acc = await taskAccess(id, user);
    if (!acc?.canWork) throw new DomainError("tasks.notYourTask");
    const work = taskWorkPatchSchema.parse(pick(input, ["status", "progress", "delayReason"]));
    const mgrInput = pick(input, ["title", "scope", "price", "estimatedHours", "startDate", "priority"]);
    if (Object.keys(mgrInput).length && !acc.canManage) throw new DomainError("auth.forbidden");
    const mgr = taskManagerPatchSchema.parse(mgrInput);

    const before = await db.deliveryTask.findUniqueOrThrow({ where: { id } });
    const data: Prisma.DeliveryTaskUpdateInput = { ...mgr, ...work };
    if (work.status) {
      const nowDone = isDone(work.status);
      data.deliveredAt = nowDone ? (before.deliveredAt ?? new Date()) : null;
      if (nowDone) data.progress = 100;
    }
    const after = await db.$transaction(async (tx) => {
      const a = await tx.deliveryTask.update({ where: { id }, data });
      if (work.status && work.status !== before.status) await syncProjectStatus(tx, before.projectId);
      await audit(tx, { actorId: user.id, action: "UPDATE", entity: "DeliveryTask", entityId: id, before, after: a });
      return a;
    });
    if (work.status && work.status !== before.status && after.status === "DELIVERED") {
      await notifyTaskEvent("TASK_DELIVERED", id, { actorId: user.id });
    }
    revalidateDelivery(before.projectId, id);
  });
}

function pick(o: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => keys.includes(k)));
}

/** Change a due date: reason required, logged; managers and the task lead only. */
export async function changeDueDateAction(id: string, input: unknown) {
  return runAction(async () => {
    const user = await me();
    const acc = await taskAccess(id, user);
    if (!acc?.canChangeDue) throw new DomainError("tasks.cannotChangeDue");
    const data = dueDateChangeSchema.parse(input);
    const before = await db.deliveryTask.findUniqueOrThrow({ where: { id } });
    const same = (before.dueDate?.getTime() ?? null) === (data.newDate?.getTime() ?? null);
    if (same) return;
    await db.$transaction(async (tx) => {
      await tx.deliveryTask.update({
        where: { id },
        data: { dueDate: data.newDate, originalDueDate: before.originalDueDate ?? before.dueDate ?? data.newDate },
      });
      await tx.taskDueDateChange.create({ data: { taskId: id, changedById: user.id, oldDate: before.dueDate, newDate: data.newDate, reason: data.reason } });
      await audit(tx, { actorId: user.id, action: "UPDATE", entity: "DeliveryTask", entityId: id, before: { dueDate: before.dueDate }, after: { dueDate: data.newDate, reason: data.reason } });
    });
    await notifyTaskEvent("TASK_DUE_CHANGED", id, { actorId: user.id });
    revalidateDelivery(before.projectId, id);
  });
}

/** Replace assignees and watchers (managers only). Newly added people are notified. */
export async function setTaskPeopleAction(id: string, input: { assignees: { userId: string; role: "LEAD" | "MEMBER" }[]; watchers: string[] }) {
  return runAction(async () => {
    const user = await requirePermission("manageDelivery");
    const { assignees, watchers } = draftTaskSchema.pick({ assignees: true, watchers: true }).parse(input);
    const before = await db.deliveryTask.findUniqueOrThrow({ where: { id }, include: { assignees: true, watchers: true } });
    await db.$transaction(async (tx) => {
      await tx.taskAssignee.deleteMany({ where: { taskId: id } });
      await tx.taskWatcher.deleteMany({ where: { taskId: id } });
      if (assignees.length) await tx.taskAssignee.createMany({ data: assignees.map((a) => ({ taskId: id, ...a })) });
      const w = watchers.filter((x) => !assignees.some((a) => a.userId === x));
      if (w.length) await tx.taskWatcher.createMany({ data: w.map((userId) => ({ taskId: id, userId })) });
      await audit(tx, { actorId: user.id, action: "UPDATE", entity: "DeliveryTask", entityId: id, before: { assignees: before.assignees, watchers: before.watchers }, after: { assignees, watchers: w } });
    });
    const added = assignees.map((a) => a.userId).filter((u) => !before.assignees.some((b) => b.userId === u));
    if (added.length) await notifyTaskEvent("TASK_ASSIGNED", id, { actorId: user.id, userIds: added });
    revalidateDelivery(before.projectId, id);
  });
}

export async function deleteTaskAction(id: string) {
  return runAction(async () => {
    const user = await requirePermission("manageDelivery");
    const before = await db.deliveryTask.findUniqueOrThrow({ where: { id } });
    await db.$transaction(async (tx) => {
      await tx.attachment.deleteMany({ where: { entityType: "DELIVERY_TASK", entityId: id } });
      await tx.deliveryTask.delete({ where: { id } });
      await syncProjectStatus(tx, before.projectId);
      await audit(tx, { actorId: user.id, action: "DELETE", entity: "DeliveryTask", entityId: id, before });
    });
    revalidateDelivery(before.projectId);
    return { projectId: before.projectId };
  });
}

// ---------------------------------------------------------------------------
// Checklist, comments, time logs
// ---------------------------------------------------------------------------

async function requireWork(taskId: string) {
  const user = await me();
  const acc = await taskAccess(taskId, user);
  if (!acc?.canWork) throw new DomainError("tasks.notYourTask");
  return { user, acc };
}

export async function addChecklistItemAction(taskId: string, title: string) {
  return runAction(async () => {
    const { acc } = await requireWork(taskId);
    const data = checklistSchema.parse({ title });
    const max = await db.taskChecklistItem.aggregate({ where: { taskId }, _max: { sortOrder: true } });
    await db.taskChecklistItem.create({ data: { taskId, title: data.title, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
    revalidateDelivery(acc.task.projectId, taskId);
  });
}

export async function toggleChecklistItemAction(itemId: string, done: boolean) {
  return runAction(async () => {
    const item = await db.taskChecklistItem.findUniqueOrThrow({ where: { id: itemId } });
    const { acc } = await requireWork(item.taskId);
    await db.taskChecklistItem.update({ where: { id: itemId }, data: { done, doneAt: done ? new Date() : null } });
    revalidateDelivery(acc.task.projectId, item.taskId);
  });
}

export async function deleteChecklistItemAction(itemId: string) {
  return runAction(async () => {
    const item = await db.taskChecklistItem.findUniqueOrThrow({ where: { id: itemId } });
    const { acc } = await requireWork(item.taskId);
    await db.taskChecklistItem.delete({ where: { id: itemId } });
    revalidateDelivery(acc.task.projectId, item.taskId);
  });
}

/** Comment with @mentions (mentions = ids of people who can see the task). */
export async function addCommentAction(taskId: string, body: string, mentionIds: string[]) {
  return runAction(async () => {
    const user = await me();
    const acc = await taskAccess(taskId, user);
    if (!acc?.canComment) throw new DomainError("tasks.notYourTask");
    const data = commentSchema.parse({ body });
    const mentions = [...new Set(mentionIds)].filter((m) => m !== user.id).slice(0, 20);
    const valid = mentions.length ? (await db.user.findMany({ where: { id: { in: mentions }, active: true }, select: { id: true } })).map((u) => u.id) : [];
    await db.taskComment.create({ data: { taskId, authorId: user.id, body: data.body, mentions: valid } });
    if (valid.length) await notifyTaskEvent("TASK_MENTION", taskId, { actorId: user.id, userIds: valid });
    revalidateDelivery(acc.task.projectId, taskId);
  });
}

export async function deleteCommentAction(commentId: string) {
  return runAction(async () => {
    const user = await me();
    const c = await db.taskComment.findUniqueOrThrow({ where: { id: commentId }, include: { task: { select: { projectId: true } } } });
    const acc = await taskAccess(c.taskId, user);
    if (c.authorId !== user.id && !acc?.canManage) throw new DomainError("auth.forbidden");
    await db.taskComment.delete({ where: { id: commentId } });
    revalidateDelivery(c.task.projectId, c.taskId);
  });
}

/** Log hours on a task — for yourself, as an assignee (managers may log too). */
export async function logTimeAction(taskId: string, input: unknown) {
  return runAction(async () => {
    const { user, acc } = await requireWork(taskId);
    const data = timeLogSchema.parse(input);
    await db.taskTimeLog.create({ data: { taskId, userId: user.id, date: data.date, hours: data.hours, note: data.note } });
    revalidateDelivery(acc.task.projectId, taskId);
  });
}

export async function deleteTimeLogAction(logId: string) {
  return runAction(async () => {
    const user = await me();
    const l = await db.taskTimeLog.findUniqueOrThrow({ where: { id: logId }, include: { task: { select: { projectId: true } } } });
    const acc = await taskAccess(l.taskId, user);
    if (l.userId !== user.id && !acc?.canManage) throw new DomainError("auth.forbidden");
    await db.taskTimeLog.delete({ where: { id: logId } });
    revalidateDelivery(l.task.projectId, l.taskId);
  });
}
