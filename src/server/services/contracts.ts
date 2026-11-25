import "server-only";
import { db } from "@/lib/db";
import { todayUTC } from "@/lib/format";

export async function listContracts() {
  const today = todayUTC();
  const rows = await db.contract.findMany({
    orderBy: { contractDate: "desc" },
    include: {
      client: { select: { id: true, nameAr: true, nameEn: true } },
      products: { include: { product: { select: { id: true, labelAr: true, labelEn: true } } } },
      amcLines: { select: { dueDate: true, amount: true, status: true }, orderBy: { yearIndex: "asc" } },
    },
  });
  return rows.map((c) => {
    const next = c.amcLines.find((l) => l.status !== "PAID");
    return {
      id: c.id,
      number: c.number,
      title: c.title,
      client: c.client,
      products: c.products.map((p) => p.product),
      contractDate: c.contractDate.toISOString(),
      value: Number(c.value),
      currency: c.currency,
      status: c.status,
      amcPercent: Number(c.amcPercent),
      nextAmcDue: next ? next.dueDate.toISOString() : null,
      nextAmcAmount: next ? Number(next.amount) : null,
      nextAmcOverdue: !!next && next.dueDate < today,
      overdueCount: c.amcLines.filter((l) => l.status === "OVERDUE").length,
    };
  });
}
export type ContractRow = Awaited<ReturnType<typeof listContracts>>[number];

export async function getContract(id: string) {
  const c = await db.contract.findUnique({
    where: { id },
    include: {
      client: { include: { contacts: true } },
      products: { include: { product: true } },
      amcLines: { orderBy: { yearIndex: "asc" } },
      requests: { orderBy: { requestDate: "desc" }, select: { id: true, number: true, title: true, status: true, dueDate: true } },
    },
  });
  return c;
}

/** JSON-safe AMC lines for client components. */
export function serializeAmcLines(lines: NonNullable<Awaited<ReturnType<typeof getContract>>>["amcLines"]) {
  return lines.map((l) => ({
    id: l.id,
    yearIndex: l.yearIndex,
    dueDate: l.dueDate.toISOString(),
    amount: Number(l.amount),
    increasePercentOverride: l.increasePercentOverride != null ? Number(l.increasePercentOverride) : null,
    amountOverride: l.amountOverride != null ? Number(l.amountOverride) : null,
    status: l.status,
    paidAt: l.paidAt?.toISOString() ?? null,
    paidAmount: l.paidAmount != null ? Number(l.paidAmount) : null,
    invoiceRef: l.invoiceRef,
    notes: l.notes,
  }));
}
export type AmcLineDTO = ReturnType<typeof serializeAmcLines>[number];
