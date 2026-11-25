import "server-only";
import { db } from "@/lib/db";
import { todayUTC } from "@/lib/format";

const OPEN_REQUEST_STATUSES = ["NEW", "UNDER_STUDY", "QUOTED", "APPROVED", "IN_PROGRESS"] as const;

function sumBy<T>(rows: T[], f: (r: T) => number) {
  return rows.reduce((s, r) => s + f(r), 0);
}

/** KPI figures for the dashboard. Amounts are grouped by currency. */
export async function getDashboardKpis() {
  const today = todayUTC();
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const q = Math.floor(m / 3);
  const monthStart = new Date(Date.UTC(y, m, 1));
  const monthEnd = new Date(Date.UTC(y, m + 1, 1));
  const quarterStart = new Date(Date.UTC(y, q * 3, 1));
  const quarterEnd = new Date(Date.UTC(y, q * 3 + 3, 1));
  const yearStart = new Date(Date.UTC(y, 0, 1));
  const yearEnd = new Date(Date.UTC(y + 1, 0, 1));
  const in90 = new Date(today.getTime() + 90 * 86_400_000);

  const activeContractFilter = { contract: { status: "ACTIVE" as const } };

  const [activeClients, activeContracts, yearLines, overdueLines, openRequests, overdueRequests, pendingQuotes, upcoming] =
    await Promise.all([
      db.client.count({ where: { status: { key: "ACTIVE" } } }),
      db.contract.count({ where: { status: "ACTIVE" } }),
      db.amcScheduleLine.findMany({
        where: { ...activeContractFilter, dueDate: { gte: yearStart, lt: yearEnd } },
        select: { dueDate: true, amount: true, contract: { select: { currency: true } } },
      }),
      db.amcScheduleLine.findMany({
        where: { ...activeContractFilter, status: { not: "PAID" }, dueDate: { lt: today } },
        select: { amount: true },
      }),
      db.clientRequest.count({ where: { status: { in: [...OPEN_REQUEST_STATUSES] } } }),
      db.clientRequest.count({ where: { status: { in: [...OPEN_REQUEST_STATUSES] }, dueDate: { lt: today } } }),
      db.quotation.findMany({
        where: { status: { in: ["DRAFT", "SENT"] } },
        select: { discount: true, vatPercent: true, items: { select: { qty: true, unitPrice: true } } },
      }),
      db.amcScheduleLine.findMany({
        where: { ...activeContractFilter, status: { not: "PAID" }, dueDate: { gte: today, lte: in90 } },
        orderBy: { dueDate: "asc" },
        take: 15,
        select: {
          id: true,
          yearIndex: true,
          dueDate: true,
          amount: true,
          contract: { select: { id: true, number: true, currency: true, client: { select: { id: true, nameAr: true, nameEn: true } } } },
        },
      }),
    ]);

  const inRange = (d: Date, a: Date, b: Date) => d >= a && d < b;
  const amt = (r: { amount: unknown }) => Number(r.amount);

  const pendingQuotationsValue = sumBy(pendingQuotes, (qt) => {
    const sub = sumBy(qt.items, (i) => Number(i.qty) * Number(i.unitPrice)) - Number(qt.discount);
    return sub * (1 + Number(qt.vatPercent) / 100);
  });

  return {
    activeClients,
    activeContracts,
    amcMonth: sumBy(yearLines.filter((l) => inRange(l.dueDate, monthStart, monthEnd)), amt),
    amcQuarter: sumBy(yearLines.filter((l) => inRange(l.dueDate, quarterStart, quarterEnd)), amt),
    amcYear: sumBy(yearLines, amt),
    overdueAmcCount: overdueLines.length,
    overdueAmcValue: sumBy(overdueLines, amt),
    openRequests,
    overdueRequests,
    pendingQuotationsValue,
    upcoming,
  };
}
