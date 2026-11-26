import "server-only";
import { db } from "@/lib/db";
import { todayUTC } from "@/lib/format";
import { computeTotals } from "@/lib/totals";

export async function listQuotations() {
  const today = todayUTC();
  const rows = await db.quotation.findMany({
    orderBy: [{ issueDate: "desc" }, { number: "desc" }, { version: "desc" }],
    include: {
      client: { select: { id: true, nameAr: true, nameEn: true } },
      items: { select: { qty: true, unitPrice: true } },
    },
  });
  // Mark the latest version of each quotation number.
  const latest = new Map<string, number>();
  for (const r of rows) latest.set(r.number, Math.max(latest.get(r.number) ?? 0, r.version));
  return rows.map((q) => ({
    id: q.id,
    number: q.number,
    version: q.version,
    isLatest: latest.get(q.number) === q.version,
    title: q.title,
    client: q.client,
    status: q.status,
    lang: q.lang,
    issueDate: q.issueDate.toISOString(),
    validUntil: q.validUntil.toISOString(),
    expired: q.status !== "ACCEPTED" && q.status !== "REJECTED" && q.validUntil < today,
    currency: q.currency,
    total: computeTotals(q.items, q.discount, q.vatPercent).total,
  }));
}
export type QuotationRow = Awaited<ReturnType<typeof listQuotations>>[number];

export async function getQuotation(id: string) {
  const q = await db.quotation.findUnique({
    where: { id },
    include: {
      client: { include: { contacts: true } },
      items: { orderBy: { sortOrder: "asc" }, include: { request: { select: { id: true, number: true, title: true } } } },
    },
  });
  if (!q) return null;
  const versions = await db.quotation.findMany({
    where: { number: q.number },
    orderBy: { version: "desc" },
    select: { id: true, version: true, status: true, issueDate: true },
  });
  return { ...q, versions };
}
