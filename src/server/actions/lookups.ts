"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { lookupSchema, type LookupInput } from "@/lib/validation/lookup";
import { requirePermission } from "@/server/auth-guard";
import { DomainError, runAction } from "@/server/action-result";
import { audit } from "@/server/services/audit";

export async function saveLookupAction(id: string | null, input: LookupInput) {
  return runAction(async () => {
    const user = await requirePermission("manageSettings");
    const data = lookupSchema.parse(input);
    await db.$transaction(async (tx) => {
      if (id) {
        const before = await tx.lookupValue.findUniqueOrThrow({ where: { id } });
        // System keys are referenced by code (e.g. ACTIVE client status) — keep key & kind stable.
        const patch = before.isSystem ? { labelAr: data.labelAr, labelEn: data.labelEn, color: data.color, active: data.active } : data;
        if (before.isSystem && !data.active) throw new DomainError("lookups.systemCannotDisable");
        const after = await tx.lookupValue.update({ where: { id }, data: patch });
        await audit(tx, { actorId: user.id, action: "UPDATE", entity: "LookupValue", entityId: id, before, after });
      } else {
        const max = await tx.lookupValue.aggregate({ where: { kind: data.kind }, _max: { sortOrder: true } });
        const created = await tx.lookupValue.create({ data: { ...data, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
        await audit(tx, { actorId: user.id, action: "CREATE", entity: "LookupValue", entityId: created.id, after: created });
      }
    });
    revalidatePath("/settings/lists");
  });
}

export async function moveLookupAction(id: string, direction: -1 | 1) {
  return runAction(async () => {
    await requirePermission("manageSettings");
    const item = await db.lookupValue.findUniqueOrThrow({ where: { id } });
    const siblings = await db.lookupValue.findMany({ where: { kind: item.kind }, orderBy: [{ sortOrder: "asc" }, { labelEn: "asc" }] });
    const i = siblings.findIndex((s) => s.id === id);
    const j = i + direction;
    if (j < 0 || j >= siblings.length) return;
    [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
    await db.$transaction(siblings.map((s, idx) => db.lookupValue.update({ where: { id: s.id }, data: { sortOrder: idx } })));
    revalidatePath("/settings/lists");
  });
}

export async function deleteLookupAction(id: string) {
  return runAction(async () => {
    const user = await requirePermission("manageSettings");
    const before = await db.lookupValue.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { clientsByStatus: true, clientsByIndustry: true, contractProducts: true, requestsByType: true } } },
    });
    if (before.isSystem) throw new DomainError("lookups.systemCannotDelete");
    const used = Object.values(before._count).some((n) => n > 0);
    if (used) throw new DomainError("lookups.inUse");
    await db.$transaction(async (tx) => {
      await tx.lookupValue.delete({ where: { id } });
      await audit(tx, { actorId: user.id, action: "DELETE", entity: "LookupValue", entityId: id, before });
    });
    revalidatePath("/settings/lists");
  });
}
