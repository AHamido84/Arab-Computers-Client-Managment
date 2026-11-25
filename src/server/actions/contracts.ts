"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  amcLineOverrideSchema,
  amcPaymentSchema,
  contractSchema,
  type AmcLineOverrideInput,
  type AmcPaymentInput,
  type ContractInput,
} from "@/lib/validation/contract";
import { requirePermission } from "@/server/auth-guard";
import { DomainError, runAction } from "@/server/action-result";
import { activity, audit } from "@/server/services/audit";
import { nextNumber } from "@/server/services/numbering";
import { syncAmcSchedule } from "@/server/services/amc";

function revalidateContract(id: string, clientId: string) {
  revalidatePath("/contracts");
  revalidatePath(`/contracts/${id}`);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/");
}

export async function createContractAction(input: ContractInput) {
  return runAction(async () => {
    const user = await requirePermission("write");
    const { productIds, ...data } = contractSchema.parse(input);
    const c = await db.$transaction(async (tx) => {
      const number = await nextNumber(tx, "contract", data.contractDate);
      const created = await tx.contract.create({
        data: { ...data, number, products: { create: productIds.map((productId) => ({ productId })) } },
      });
      await syncAmcSchedule(tx, created.id);
      await audit(tx, { actorId: user.id, action: "CREATE", entity: "Contract", entityId: created.id, after: created });
      await activity(tx, { clientId: created.clientId, type: "contract.created", summary: number, refType: "contract", refId: created.id, actorId: user.id });
      return created;
    });
    revalidateContract(c.id, c.clientId);
    return { id: c.id };
  });
}

export async function updateContractAction(id: string, input: ContractInput) {
  return runAction(async () => {
    const user = await requirePermission("write");
    const { productIds, ...data } = contractSchema.parse(input);
    const after = await db.$transaction(async (tx) => {
      const before = await tx.contract.findUniqueOrThrow({ where: { id } });
      if (before.clientId !== data.clientId) {
        const hasPaid = await tx.amcScheduleLine.count({ where: { contractId: id, status: "PAID" } });
        if (hasPaid) throw new DomainError("contracts.cannotMoveClient");
      }
      await tx.contractProduct.deleteMany({ where: { contractId: id } });
      const updated = await tx.contract.update({
        where: { id },
        data: { ...data, products: { create: productIds.map((productId) => ({ productId })) } },
      });
      await syncAmcSchedule(tx, id);
      await audit(tx, { actorId: user.id, action: "UPDATE", entity: "Contract", entityId: id, before, after: updated });
      const type = before.status !== updated.status ? "contract.statusChanged" : "contract.updated";
      await activity(tx, { clientId: updated.clientId, type, summary: `${updated.number} · ${updated.status}`, refType: "contract", refId: id, actorId: user.id });
      return updated;
    });
    revalidateContract(id, after.clientId);
    return { id };
  });
}

export async function deleteContractAction(id: string) {
  return runAction(async () => {
    const user = await requirePermission("delete");
    const before = await db.contract.findUniqueOrThrow({ where: { id } });
    await db.$transaction(async (tx) => {
      const paid = await tx.amcScheduleLine.count({ where: { contractId: id, status: "PAID" } });
      if (paid) throw new DomainError("contracts.cannotDeletePaid");
      await tx.attachment.deleteMany({ where: { entityType: "CONTRACT", entityId: id } });
      await tx.contract.delete({ where: { id } });
      await audit(tx, { actorId: user.id, action: "DELETE", entity: "Contract", entityId: id, before });
      await activity(tx, { clientId: before.clientId, type: "contract.deleted", summary: before.number, actorId: user.id });
    });
    revalidateContract(id, before.clientId);
  });
}

// ---------------------------------------------------------------------------
// AMC schedule lines
// ---------------------------------------------------------------------------

async function lineWithContract(lineId: string) {
  return db.amcScheduleLine.findUniqueOrThrow({ where: { id: lineId }, include: { contract: true } });
}

/** Set / clear per-year overrides. Following years are recalculated. */
export async function updateAmcLineAction(lineId: string, input: AmcLineOverrideInput) {
  return runAction(async () => {
    const user = await requirePermission("write");
    const data = amcLineOverrideSchema.parse(input);
    const line = await lineWithContract(lineId);
    if (line.status === "PAID") throw new DomainError("amc.lockedPaid");
    await db.$transaction(async (tx) => {
      const after = await tx.amcScheduleLine.update({ where: { id: lineId }, data });
      await syncAmcSchedule(tx, line.contractId);
      await audit(tx, { actorId: user.id, action: "UPDATE", entity: "AmcScheduleLine", entityId: lineId, before: line, after });
      await activity(tx, {
        clientId: line.contract.clientId, type: "amc.overridden", summary: `${line.contract.number} · Y${line.yearIndex}`,
        refType: "contract", refId: line.contractId, actorId: user.id,
      });
    });
    revalidateContract(line.contractId, line.contract.clientId);
  });
}

export async function resetAmcOverridesAction(contractId: string) {
  return runAction(async () => {
    const user = await requirePermission("write");
    const c = await db.contract.findUniqueOrThrow({ where: { id: contractId } });
    await db.$transaction(async (tx) => {
      await tx.amcScheduleLine.updateMany({
        where: { contractId, status: { not: "PAID" } },
        data: { increasePercentOverride: null, amountOverride: null },
      });
      await syncAmcSchedule(tx, contractId);
      await audit(tx, { actorId: user.id, action: "UPDATE", entity: "Contract", entityId: contractId, before: {}, after: { amcOverrides: "reset" } });
    });
    revalidateContract(contractId, c.clientId);
  });
}

export async function markAmcPaidAction(lineId: string, input: AmcPaymentInput) {
  return runAction(async () => {
    const user = await requirePermission("write");
    const data = amcPaymentSchema.parse(input);
    const line = await lineWithContract(lineId);
    await db.$transaction(async (tx) => {
      const after = await tx.amcScheduleLine.update({ where: { id: lineId }, data: { ...data, status: "PAID" } });
      await audit(tx, { actorId: user.id, action: "UPDATE", entity: "AmcScheduleLine", entityId: lineId, before: line, after });
      await activity(tx, {
        clientId: line.contract.clientId, type: "amc.paid", summary: `${line.contract.number} · Y${line.yearIndex}`,
        meta: { amount: data.paidAmount, currency: line.contract.currency }, refType: "contract", refId: line.contractId, actorId: user.id,
      });
      // Dismiss open AMC alerts for this line.
      await tx.notification.updateMany({ where: { entityType: "amc", entityId: lineId, dismissedAt: null }, data: { dismissedAt: new Date() } });
    });
    revalidateContract(line.contractId, line.contract.clientId);
  });
}

export async function unmarkAmcPaidAction(lineId: string) {
  return runAction(async () => {
    const user = await requirePermission("write");
    const line = await lineWithContract(lineId);
    await db.$transaction(async (tx) => {
      const after = await tx.amcScheduleLine.update({
        where: { id: lineId },
        data: { status: "PENDING", paidAt: null, paidAmount: null, invoiceRef: null },
      });
      await syncAmcSchedule(tx, line.contractId);
      await audit(tx, { actorId: user.id, action: "UPDATE", entity: "AmcScheduleLine", entityId: lineId, before: line, after });
      await activity(tx, {
        clientId: line.contract.clientId, type: "amc.unpaid", summary: `${line.contract.number} · Y${line.yearIndex}`,
        refType: "contract", refId: line.contractId, actorId: user.id,
      });
    });
    revalidateContract(line.contractId, line.contract.clientId);
  });
}
