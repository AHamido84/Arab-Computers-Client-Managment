"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { canTransition, quotationSchema, type QuotationInput, type QuotationStatus } from "@/lib/validation/quotation";
import { todayUTC } from "@/lib/format";
import { requirePermission } from "@/server/auth-guard";
import { DomainError, runAction } from "@/server/action-result";
import { activity, audit } from "@/server/services/audit";
import { nextNumber } from "@/server/services/numbering";
import { getSettings } from "@/server/services/settings";

function revalidateQuotation(id: string, clientId: string) {
  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/requests");
  revalidatePath("/");
}

type Parsed = ReturnType<typeof quotationSchema.parse>;
const itemRows = (items: Parsed["items"]) =>
  items.map(({ requestId, title, scope, startDate, dueDate, qty, unitPrice }, i) => ({ requestId, title, scope, startDate, dueDate, qty, unitPrice, sortOrder: i }));

/** Requests referenced by quotation items must belong to the same client. */
async function assertRequestsBelong(tx: Prisma.TransactionClient, clientId: string, items: Parsed["items"]) {
  const ids = [...new Set(items.map((i) => i.requestId).filter(Boolean) as string[])];
  if (!ids.length) return ids;
  const count = await tx.clientRequest.count({ where: { id: { in: ids }, clientId } });
  if (count !== ids.length) throw new DomainError("quotations.requestMismatch");
  return ids;
}

export async function createQuotationAction(input: QuotationInput) {
  return runAction(async () => {
    const user = await requirePermission("write");
    const { items, ...data } = quotationSchema.parse(input);
    const q = await db.$transaction(async (tx) => {
      const requestIds = await assertRequestsBelong(tx, data.clientId, items);
      const number = await nextNumber(tx, "quotation", data.issueDate);
      const created = await tx.quotation.create({ data: { ...data, number, version: 1, status: "DRAFT", items: { create: itemRows(items) } } });
      // Requests that are being quoted move to QUOTED.
      if (requestIds.length) {
        await tx.clientRequest.updateMany({ where: { id: { in: requestIds }, status: { in: ["NEW", "UNDER_STUDY"] } }, data: { status: "QUOTED" } });
      }
      await audit(tx, { actorId: user.id, action: "CREATE", entity: "Quotation", entityId: created.id, after: created });
      await activity(tx, { clientId: data.clientId, type: "quotation.created", summary: `${number} v1`, refType: "quotation", refId: created.id, actorId: user.id });
      return created;
    });
    revalidateQuotation(q.id, q.clientId);
    return { id: q.id };
  });
}

export async function updateQuotationAction(id: string, input: QuotationInput) {
  return runAction(async () => {
    const user = await requirePermission("write");
    const { items, ...data } = quotationSchema.parse(input);
    const after = await db.$transaction(async (tx) => {
      const before = await tx.quotation.findUniqueOrThrow({ where: { id } });
      if (before.status !== "DRAFT") throw new DomainError("quotations.onlyDraftEditable");
      if (before.clientId !== data.clientId) throw new DomainError("quotations.cannotChangeClient");
      await assertRequestsBelong(tx, data.clientId, items);
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      const updated = await tx.quotation.update({ where: { id }, data: { ...data, items: { create: itemRows(items) } } });
      await audit(tx, { actorId: user.id, action: "UPDATE", entity: "Quotation", entityId: id, before, after: updated });
      return updated;
    });
    revalidateQuotation(id, after.clientId);
    return { id };
  });
}

export async function setQuotationStatusAction(id: string, to: QuotationStatus) {
  return runAction(async () => {
    const user = await requirePermission("write");
    const q = await db.quotation.findUniqueOrThrow({ where: { id }, include: { items: { select: { requestId: true } } } });
    if (!canTransition(q.status, to)) throw new DomainError("quotations.badTransition");
    await db.$transaction(async (tx) => {
      const after = await tx.quotation.update({
        where: { id },
        data: {
          status: to,
          sentAt: to === "SENT" ? (q.sentAt ?? new Date()) : to === "DRAFT" ? null : q.sentAt,
          decidedAt: to === "ACCEPTED" || to === "REJECTED" ? new Date() : null,
        },
      });
      const requestIds = [...new Set(q.items.map((i) => i.requestId).filter(Boolean) as string[])];
      if (to === "ACCEPTED" && requestIds.length) {
        await tx.clientRequest.updateMany({ where: { id: { in: requestIds }, status: "QUOTED" }, data: { status: "APPROVED" } });
      }
      await audit(tx, { actorId: user.id, action: "UPDATE", entity: "Quotation", entityId: id, before: q, after });
      await activity(tx, { clientId: q.clientId, type: "quotation.statusChanged", summary: `${q.number} v${q.version} · ${to}`, refType: "quotation", refId: id, actorId: user.id });
    });
    revalidateQuotation(id, q.clientId);
  });
}

/** Copy a quotation into a new DRAFT version (same number, version + 1). */
export async function newQuotationVersionAction(id: string) {
  return runAction(async () => {
    const user = await requirePermission("write");
    const settings = await getSettings();
    const src = await db.quotation.findUniqueOrThrow({ where: { id }, include: { items: true } });
    const created = await db.$transaction(async (tx) => {
      const max = await tx.quotation.aggregate({ where: { number: src.number }, _max: { version: true } });
      const issueDate = todayUTC();
      const c = await tx.quotation.create({
        data: {
          number: src.number,
          version: (max._max.version ?? src.version) + 1,
          clientId: src.clientId,
          title: src.title,
          lang: src.lang,
          status: "DRAFT",
          issueDate,
          validUntil: new Date(issueDate.getTime() + settings.quotationValidityDays * 86_400_000),
          currency: src.currency,
          discount: src.discount,
          vatPercent: src.vatPercent,
          introText: src.introText,
          terms: src.terms,
          items: {
            create: src.items.map(({ requestId, title, scope, startDate, dueDate, qty, unitPrice, sortOrder }) => ({
              requestId, title, scope, startDate, dueDate, qty, unitPrice, sortOrder,
            })),
          },
        },
      });
      await audit(tx, { actorId: user.id, action: "CREATE", entity: "Quotation", entityId: c.id, after: c });
      await activity(tx, { clientId: c.clientId, type: "quotation.created", summary: `${c.number} v${c.version}`, refType: "quotation", refId: c.id, actorId: user.id });
      return c;
    });
    revalidateQuotation(created.id, created.clientId);
    return { id: created.id };
  });
}

export async function deleteQuotationAction(id: string) {
  return runAction(async () => {
    const user = await requirePermission("delete");
    const before = await db.quotation.findUniqueOrThrow({ where: { id } });
    if (before.status !== "DRAFT") throw new DomainError("quotations.onlyDraftDeletable");
    await db.$transaction(async (tx) => {
      await tx.attachment.deleteMany({ where: { entityType: "QUOTATION", entityId: id } });
      await tx.quotation.delete({ where: { id } });
      await audit(tx, { actorId: user.id, action: "DELETE", entity: "Quotation", entityId: id, before });
    });
    revalidateQuotation(id, before.clientId);
  });
}
