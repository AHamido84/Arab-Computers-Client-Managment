import "server-only";
import { db } from "@/lib/db";
import type { LookupKind } from "@/generated/prisma/enums";

export type LookupOption = { id: string; key: string; labelAr: string; labelEn: string; color: string | null; active: boolean };

export async function getLookups(kind: LookupKind, includeInactive = false): Promise<LookupOption[]> {
  return db.lookupValue.findMany({
    where: { kind, ...(includeInactive ? {} : { active: true }) },
    orderBy: [{ sortOrder: "asc" }, { labelEn: "asc" }],
    select: { id: true, key: true, labelAr: true, labelEn: true, color: true, active: true },
  });
}

/** Users who can own clients / be assigned work. */
export async function getAssignableUsers() {
  return db.user.findMany({
    where: { active: true, role: { in: ["ADMIN", "ACCOUNT_MANAGER"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getClientOptions() {
  return db.client.findMany({
    orderBy: { nameEn: "asc" },
    select: { id: true, code: true, nameAr: true, nameEn: true, preferredLang: true },
  });
}
