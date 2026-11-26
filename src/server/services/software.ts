import "server-only";
import { db } from "@/lib/db";

/** All software / systems with usage counts. */
export async function listSoftware() {
  const rows = await db.lookupValue.findMany({
    where: { kind: "PRODUCT" },
    orderBy: [{ sortOrder: "asc" }, { labelEn: "asc" }],
    include: { contractProducts: { select: { contract: { select: { clientId: true, status: true } } } } },
  });
  return rows.map((r) => ({
    id: r.id,
    nameAr: r.labelAr,
    nameEn: r.labelEn,
    description: r.description,
    active: r.active,
    contracts: r.contractProducts.length,
    activeContracts: r.contractProducts.filter((c) => c.contract.status === "ACTIVE").length,
    clients: new Set(r.contractProducts.map((c) => c.contract.clientId)).size,
  }));
}
export type SoftwareRow = Awaited<ReturnType<typeof listSoftware>>[number];

export async function getSoftware(id: string) {
  const r = await db.lookupValue.findFirst({
    where: { id, kind: "PRODUCT" },
    include: {
      contractProducts: {
        select: {
          contract: {
            select: {
              id: true, number: true, title: true, status: true, startDate: true, endDate: true,
              client: { select: { id: true, nameAr: true, nameEn: true } },
            },
          },
        },
      },
    },
  });
  if (!r) return null;
  const contracts = r.contractProducts.map((c) => c.contract).sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
  return {
    id: r.id,
    nameAr: r.labelAr,
    nameEn: r.labelEn,
    description: r.description,
    active: r.active,
    createdAt: r.createdAt,
    contracts: contracts.map((c) => ({ ...c, startDate: c.startDate.toISOString(), endDate: c.endDate?.toISOString() ?? null })),
    clients: new Set(contracts.map((c) => c.client.id)).size,
  };
}
