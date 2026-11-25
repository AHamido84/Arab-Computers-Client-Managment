"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { clientSchema, type ClientInput } from "@/lib/validation/client";
import { requirePermission } from "@/server/auth-guard";
import { DomainError, runAction } from "@/server/action-result";
import { activity, audit } from "@/server/services/audit";
import { nextNumber } from "@/server/services/numbering";

/** Exactly one primary contact (the first one if none is flagged). */
function normalizeContacts<T extends { isPrimary: boolean }>(contacts: T[]): T[] {
  const idx = Math.max(0, contacts.findIndex((c) => c.isPrimary));
  return contacts.map((c, i) => ({ ...c, isPrimary: i === idx }));
}

export async function createClientAction(input: ClientInput) {
  return runAction(async () => {
    const user = await requirePermission("write");
    const { contacts, ...data } = clientSchema.parse(input);
    const client = await db.$transaction(async (tx) => {
      const code = await nextNumber(tx, "client");
      const c = await tx.client.create({
        data: {
          ...data,
          code,
          contacts: { create: normalizeContacts(contacts).map(({ name, jobTitle, phone, whatsapp, email, isPrimary }) => ({ name, jobTitle, phone, whatsapp, email, isPrimary })) },
        },
      });
      await audit(tx, { actorId: user.id, action: "CREATE", entity: "Client", entityId: c.id, after: c });
      await activity(tx, { clientId: c.id, type: "client.created", summary: c.nameEn, actorId: user.id });
      return c;
    });
    revalidatePath("/clients");
    return { id: client.id };
  });
}

export async function updateClientAction(id: string, input: ClientInput) {
  return runAction(async () => {
    const user = await requirePermission("write");
    const { contacts, ...data } = clientSchema.parse(input);
    const normalized = normalizeContacts(contacts);
    await db.$transaction(async (tx) => {
      const before = await tx.client.findUniqueOrThrow({ where: { id } });
      const keepIds = normalized.map((c) => c.id).filter(Boolean) as string[];
      await tx.contactPerson.deleteMany({ where: { clientId: id, id: { notIn: keepIds } } });
      for (const { id: contactId, ...ct } of normalized) {
        if (contactId) await tx.contactPerson.updateMany({ where: { id: contactId, clientId: id }, data: ct });
        else await tx.contactPerson.create({ data: { ...ct, clientId: id } });
      }
      const after = await tx.client.update({ where: { id }, data });
      await audit(tx, { actorId: user.id, action: "UPDATE", entity: "Client", entityId: id, before, after });
      if (before.statusId !== after.statusId) {
        const st = await tx.lookupValue.findUnique({ where: { id: after.statusId } });
        await activity(tx, { clientId: id, type: "client.statusChanged", summary: st?.labelEn ?? "", meta: { labelAr: st?.labelAr ?? "" }, actorId: user.id });
      } else {
        await activity(tx, { clientId: id, type: "client.updated", summary: after.nameEn, actorId: user.id });
      }
    });
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    return { id };
  });
}

export async function deleteClientAction(id: string) {
  return runAction(async () => {
    const user = await requirePermission("delete");
    await db.$transaction(async (tx) => {
      const c = await tx.client.findUniqueOrThrow({
        where: { id },
        include: { _count: { select: { contracts: true, requests: true, quotations: true } } },
      });
      if (c._count.contracts || c._count.requests || c._count.quotations) throw new DomainError("clients.cannotDelete");
      await tx.attachment.deleteMany({ where: { entityType: "CLIENT", entityId: id } });
      await tx.client.delete({ where: { id } });
      await audit(tx, { actorId: user.id, action: "DELETE", entity: "Client", entityId: id, before: c });
    });
    revalidatePath("/clients");
  });
}
