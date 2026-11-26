"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requestSchema, REQUEST_STATUSES, type RequestInput, type RequestStatus } from "@/lib/validation/request";
import { requirePermission } from "@/server/auth-guard";
import { DomainError, runAction } from "@/server/action-result";
import { activity, audit } from "@/server/services/audit";
import { nextNumber } from "@/server/services/numbering";

const CLOSED = ["CLOSED", "REJECTED"];

function revalidateRequest(id: string, clientId: string) {
  revalidatePath("/requests");
  revalidatePath(`/requests/${id}`);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/");
}

const itemRows = (items: ReturnType<typeof requestSchema.parse>["items"]) =>
  items.map(({ item, description, qty, unitPrice }, i) => ({ item, description, qty, unitPrice, sortOrder: i }));

export async function createRequestAction(input: RequestInput) {
  return runAction(async () => {
    const user = await requirePermission("write");
    const { items, ...data } = requestSchema.parse(input);
    const r = await db.$transaction(async (tx) => {
      const number = await nextNumber(tx, "request", data.requestDate);
      const created = await tx.clientRequest.create({
        data: { ...data, number, closedAt: CLOSED.includes(data.status) ? new Date() : null, items: { create: itemRows(items) } },
      });
      await audit(tx, { actorId: user.id, action: "CREATE", entity: "ClientRequest", entityId: created.id, after: created });
      await activity(tx, { clientId: created.clientId, type: "request.created", summary: `${number} · ${created.title}`, refType: "request", refId: created.id, actorId: user.id });
      return created;
    });
    revalidateRequest(r.id, r.clientId);
    return { id: r.id };
  });
}

export async function updateRequestAction(id: string, input: RequestInput) {
  return runAction(async () => {
    const user = await requirePermission("write");
    const { items, ...data } = requestSchema.parse(input);
    const after = await db.$transaction(async (tx) => {
      const before = await tx.clientRequest.findUniqueOrThrow({ where: { id } });
      await tx.requestItem.deleteMany({ where: { requestId: id } });
      const closedAt = CLOSED.includes(data.status) ? (before.closedAt ?? new Date()) : null;
      const updated = await tx.clientRequest.update({ where: { id }, data: { ...data, closedAt, items: { create: itemRows(items) } } });
      await audit(tx, { actorId: user.id, action: "UPDATE", entity: "ClientRequest", entityId: id, before, after: updated });
      if (before.status !== updated.status) {
        await activity(tx, { clientId: updated.clientId, type: "request.statusChanged", summary: `${updated.number} · ${updated.status}`, refType: "request", refId: id, actorId: user.id });
      }
      return updated;
    });
    revalidateRequest(id, after.clientId);
    return { id };
  });
}

/** Status change from the Kanban board (drag & drop) or quick actions. */
export async function setRequestStatusAction(id: string, status: RequestStatus) {
  return runAction(async () => {
    const user = await requirePermission("write");
    if (!REQUEST_STATUSES.includes(status)) throw new DomainError("validation.invalid");
    const before = await db.clientRequest.findUniqueOrThrow({ where: { id } });
    if (before.status === status) return { id };
    await db.$transaction(async (tx) => {
      const after = await tx.clientRequest.update({
        where: { id },
        data: { status, closedAt: CLOSED.includes(status) ? new Date() : null },
      });
      await audit(tx, { actorId: user.id, action: "UPDATE", entity: "ClientRequest", entityId: id, before, after });
      await activity(tx, { clientId: before.clientId, type: "request.statusChanged", summary: `${before.number} · ${status}`, refType: "request", refId: id, actorId: user.id });
      if (CLOSED.includes(status) || status === "DELIVERED") {
        await tx.notification.updateMany({ where: { entityType: "request", entityId: id, dismissedAt: null }, data: { dismissedAt: new Date() } });
      }
    });
    revalidateRequest(id, before.clientId);
    return { id };
  });
}

export async function deleteRequestAction(id: string) {
  return runAction(async () => {
    const user = await requirePermission("delete");
    const before = await db.clientRequest.findUniqueOrThrow({ where: { id }, include: { _count: { select: { quotationItems: true } } } });
    if (before._count.quotationItems) throw new DomainError("requests.cannotDeleteQuoted");
    await db.$transaction(async (tx) => {
      await tx.attachment.deleteMany({ where: { entityType: "REQUEST", entityId: id } });
      await tx.clientRequest.delete({ where: { id } });
      await audit(tx, { actorId: user.id, action: "DELETE", entity: "ClientRequest", entityId: id, before });
    });
    revalidateRequest(id, before.clientId);
  });
}
