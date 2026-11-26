import "server-only";
import { db } from "@/lib/db";
import { todayUTC } from "@/lib/format";
import { OPEN_REQUEST_STATUSES } from "@/lib/validation/request";
import { summarize } from "@/lib/delivery-kpis";


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

/** Next 12 months of AMC in the default currency, split into collected vs still expected. */
export async function getAmcByMonth(currency: string) {
  const today = todayUTC();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 12, 1));
  const lines = await db.amcScheduleLine.findMany({
    where: { dueDate: { gte: start, lt: end }, contract: { status: "ACTIVE", amcEnabled: true, currency } },
    select: { dueDate: true, amount: true, status: true, paidAmount: true },
  });
  return Array.from({ length: 12 }, (_, i) => {
    const m = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const inMonth = lines.filter((l) => l.dueDate.getUTCFullYear() === m.getUTCFullYear() && l.dueDate.getUTCMonth() === m.getUTCMonth());
    const collected = inMonth.filter((l) => l.status === "PAID").reduce((s, l) => s + Number(l.paidAmount ?? l.amount), 0);
    const expected = inMonth.filter((l) => l.status !== "PAID").reduce((s, l) => s + Number(l.amount), 0);
    return { month: m.toISOString(), collected: Math.round(collected), expected: Math.round(expected) };
  });
}

export async function getOverdueLists(limit = 8) {
  const today = todayUTC();
  const [amc, requests, byStatus] = await Promise.all([
    db.amcScheduleLine.findMany({
      where: { status: { not: "PAID" }, dueDate: { lt: today }, contract: { status: "ACTIVE" } },
      orderBy: { dueDate: "asc" },
      take: limit,
      select: {
        id: true, yearIndex: true, dueDate: true, amount: true,
        contract: { select: { id: true, number: true, currency: true, client: { select: { id: true, nameAr: true, nameEn: true } } } },
      },
    }),
    db.clientRequest.findMany({
      where: { status: { in: [...OPEN_REQUEST_STATUSES] }, dueDate: { lt: today } },
      orderBy: { dueDate: "asc" },
      take: limit,
      select: { id: true, number: true, title: true, dueDate: true, priority: true, client: { select: { id: true, nameAr: true, nameEn: true } }, assignee: { select: { name: true } } },
    }),
    db.clientRequest.groupBy({ by: ["status"], where: { status: { in: [...OPEN_REQUEST_STATUSES] } }, _count: { _all: true } }),
  ]);
  return {
    amc,
    requests,
    byStatus: OPEN_REQUEST_STATUSES.map((s) => ({ status: s, count: byStatus.find((b) => b.status === s)?._count._all ?? 0 })),
  };
}

/** Delivery KPIs: active projects, tasks due in the next 7 days, overdue tasks, on-time rate (last 90 days). */
export async function getDeliveryKpis() {
  const today = todayUTC();
  const in7 = new Date(today.getTime() + 7 * 86_400_000);
  const since = new Date(today.getTime() - 90 * 86_400_000);
  const open = { status: { notIn: ["DELIVERED" as const, "CLIENT_ACCEPTED" as const] }, project: { status: { in: ["ACTIVE" as const, "ON_HOLD" as const] } } };
  const [activeProjects, dueWeek, overdue, delivered] = await Promise.all([
    db.deliveryProject.count({ where: { status: { in: ["ACTIVE", "ON_HOLD"] } } }),
    db.deliveryTask.count({ where: { ...open, dueDate: { gte: today, lt: in7 } } }),
    db.deliveryTask.count({ where: { ...open, dueDate: { lt: today } } }),
    db.deliveryTask.findMany({ where: { deliveredAt: { gte: since } }, select: { deliveredAt: true, dueDate: true, originalDueDate: true } }),
  ]);
  const s = summarize(delivered.map((d) => ({ ...d, estimated: 0, actual: 0 })));
  return { activeProjects, dueWeek, overdue, onTimeRate: s.rate, onTime: s.onTime, measured: s.onTime + s.late };
}
