import "server-only";
import { db } from "@/lib/db";

const OPEN_REQ = ["NEW", "UNDER_STUDY", "QUOTED", "APPROVED", "IN_PROGRESS"] as const;

/** Rows for the clients table (plain JSON-safe values). */
export async function listClients() {
  const rows = await db.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      status: true,
      industry: true,
      accountManager: { select: { id: true, name: true } },
      contacts: { where: { isPrimary: true }, take: 1 },
      _count: { select: { contracts: true, requests: { where: { status: { in: [...OPEN_REQ] } } } } },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    code: c.code,
    nameAr: c.nameAr,
    nameEn: c.nameEn,
    city: c.city,
    preferredLang: c.preferredLang,
    status: { id: c.status.id, key: c.status.key, labelAr: c.status.labelAr, labelEn: c.status.labelEn, color: c.status.color },
    industry: c.industry ? { id: c.industry.id, labelAr: c.industry.labelAr, labelEn: c.industry.labelEn } : null,
    manager: c.accountManager,
    primaryContact: c.contacts[0] ? { name: c.contacts[0].name, phone: c.contacts[0].phone, email: c.contacts[0].email } : null,
    contractsCount: c._count.contracts,
    openRequests: c._count.requests,
    createdAt: c.createdAt.toISOString(),
  }));
}
export type ClientRow = Awaited<ReturnType<typeof listClients>>[number];

export async function getClientForEdit(id: string) {
  return db.client.findUnique({ where: { id }, include: { contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } } });
}

/** Everything the client profile page shows. */
export async function getClientProfile(id: string) {
  const c = await db.client.findUnique({
    where: { id },
    include: {
      status: true,
      industry: true,
      accountManager: { select: { id: true, name: true, email: true } },
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      contracts: {
        orderBy: { contractDate: "desc" },
        include: {
          products: { include: { product: true } },
          amcLines: { orderBy: { yearIndex: "asc" } },
        },
      },
      requests: { orderBy: { requestDate: "desc" }, include: { items: true, assignee: { select: { name: true } }, type: true } },
      quotations: { orderBy: { issueDate: "desc" }, include: { items: true } },
      emails: { orderBy: { createdAt: "desc" }, take: 100, include: { sentBy: { select: { name: true } } } },
      activities: { orderBy: { createdAt: "desc" }, take: 100, include: { actor: { select: { name: true } } } },
    },
  });
  return c;
}
