import "server-only";
import { db } from "@/lib/db";
import { todayUTC } from "@/lib/format";
import { computeTotals } from "@/lib/totals";
import { isRequestOverdue } from "@/lib/validation/request";

/** JSON-safe rows for the requests table and Kanban board. */
export async function listRequests(where: { clientId?: string } = {}) {
  const today = todayUTC();
  const rows = await db.clientRequest.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { requestDate: "desc" }],
    include: {
      client: { select: { id: true, nameAr: true, nameEn: true } },
      assignee: { select: { id: true, name: true } },
      type: { select: { id: true, labelAr: true, labelEn: true } },
      contract: { select: { id: true, number: true } },
      items: { select: { qty: true, unitPrice: true } },
      _count: { select: { quotationItems: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    title: r.title,
    client: r.client,
    assignee: r.assignee,
    type: r.type,
    contract: r.contract,
    priority: r.priority,
    status: r.status,
    requestDate: r.requestDate.toISOString(),
    dueDate: r.dueDate?.toISOString() ?? null,
    estimatedHours: r.estimatedHours != null ? Number(r.estimatedHours) : null,
    currency: r.currency,
    total: computeTotals(r.items, r.discount, r.vatPercent).total,
    overdue: isRequestOverdue(r, today),
    quoted: r._count.quotationItems > 0,
  }));
}
export type RequestRow = Awaited<ReturnType<typeof listRequests>>[number];

export async function getRequest(id: string) {
  return db.clientRequest.findUnique({
    where: { id },
    include: {
      client: { include: { contacts: true } },
      contract: { select: { id: true, number: true } },
      assignee: { select: { id: true, name: true } },
      type: true,
      items: { orderBy: { sortOrder: "asc" } },
      quotationItems: {
        select: { quotation: { select: { id: true, number: true, version: true, status: true, issueDate: true } } },
      },
    },
  });
}

/** Open requests of a client (for the quotation builder), with their items. */
export async function getQuotableRequests(clientId: string) {
  const rows = await db.clientRequest.findMany({
    where: { clientId, status: { notIn: ["CLOSED", "REJECTED"] } },
    orderBy: { requestDate: "desc" },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    title: r.title,
    status: r.status,
    dueDate: r.dueDate?.toISOString().slice(0, 10) ?? "",
    description: r.description,
    items: r.items.map((i) => ({ item: i.item, description: i.description, qty: Number(i.qty), unitPrice: Number(i.unitPrice) })),
  }));
}
export type QuotableRequest = Awaited<ReturnType<typeof getQuotableRequests>>[number];
