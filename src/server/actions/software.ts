"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { softwareKey, softwareSchema, type SoftwareInput } from "@/lib/validation/software";
import { requirePermission } from "@/server/auth-guard";
import { DomainError, runAction } from "@/server/action-result";
import { audit } from "@/server/services/audit";

const dupError = (field: "nameAr" | "nameEn") =>
  new z.ZodError([{ code: "custom", path: [field], message: "software.duplicate", input: undefined }]);

function revalidate(id?: string) {
  revalidatePath("/software");
  if (id) revalidatePath(`/software/${id}`);
  revalidatePath("/settings/lists");
  revalidatePath("/contracts");
}

export async function saveSoftwareAction(id: string | null, input: SoftwareInput) {
  return runAction(async () => {
    const user = await requirePermission("write");
    const data = softwareSchema.parse(input);
    return db.$transaction(async (tx) => {
      const others = await tx.lookupValue.findMany({ where: { kind: "PRODUCT", ...(id ? { id: { not: id } } : {}) }, select: { key: true, labelAr: true, labelEn: true } });
      const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
      if (others.some((o) => same(o.labelEn, data.nameEn))) throw dupError("nameEn");
      if (others.some((o) => same(o.labelAr, data.nameAr))) throw dupError("nameAr");
      const fields = { labelAr: data.nameAr, labelEn: data.nameEn, description: data.description, active: data.active };
      if (id) {
        const before = await tx.lookupValue.findFirstOrThrow({ where: { id, kind: "PRODUCT" } });
        if (before.isSystem && !data.active) throw new DomainError("lookups.systemCannotDisable");
        const after = await tx.lookupValue.update({ where: { id }, data: fields });
        await audit(tx, { actorId: user.id, action: "UPDATE", entity: "LookupValue", entityId: id, before, after });
        return { id };
      }
      const base = softwareKey(data.nameEn);
      const taken = new Set(others.map((o) => o.key));
      let key = base;
      for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
      const max = await tx.lookupValue.aggregate({ where: { kind: "PRODUCT" }, _max: { sortOrder: true } });
      const created = await tx.lookupValue.create({ data: { kind: "PRODUCT", key, ...fields, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
      await audit(tx, { actorId: user.id, action: "CREATE", entity: "LookupValue", entityId: created.id, after: created });
      return { id: created.id };
    }).finally(() => revalidate(id ?? undefined));
  });
}

export async function deleteSoftwareAction(id: string) {
  return runAction(async () => {
    const user = await requirePermission("delete");
    const before = await db.lookupValue.findFirstOrThrow({ where: { id, kind: "PRODUCT" }, include: { _count: { select: { contractProducts: true } } } });
    if (before.isSystem) throw new DomainError("lookups.systemCannotDelete");
    if (before._count.contractProducts > 0) throw new DomainError("software.inUse");
    await db.$transaction(async (tx) => {
      await tx.lookupValue.delete({ where: { id } });
      await audit(tx, { actorId: user.id, action: "DELETE", entity: "LookupValue", entityId: id, before });
    });
    revalidate();
  });
}
