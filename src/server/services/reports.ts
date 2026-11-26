import "server-only";
import { createTranslator } from "next-intl";
import { db } from "@/lib/db";
import { messagesFor } from "@/i18n/messages";
import { formatDate, formatMoney, formatNumber, todayUTC } from "@/lib/format";
import { computeTotals } from "@/lib/totals";
import { OPEN_REQUEST_STATUSES } from "@/lib/validation/request";
import { getSettings } from "./settings";
import { summarize, summarizeBy, type KpiItem, type KpiSummary } from "@/lib/delivery-kpis";
import { deliveredOnTime } from "@/lib/delivery";

/**
 * Report engine. Each report returns a language-specific, format-agnostic
 * structure (summary + tables with typed columns) that is rendered on screen,
 * as PDF (src/pdf/report.tsx) and as Excel (/api/reports/[type]?format=xlsx).
 */
export const REPORT_TYPES = ["amc", "requests", "quotations", "delivery", "statement"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];
type Lang = "ar" | "en";

export type ColType = "text" | "money" | "date" | "number" | "status";
export type ReportColumn = { key: string; label: string; type: ColType; align?: "start" | "end" };
export type ReportRow = Record<string, string | number | null> & { _currency?: string | null; _href?: string | null; _tone?: string | null };
export type ReportTable = { title?: string; columns: ReportColumn[]; rows: ReportRow[]; footer?: Record<string, string | number> };
export type ReportResult = { type: ReportType; title: string; filtersText: string; summary: [string, string][]; tables: ReportTable[]; currency: string; empty: boolean };

export type ReportFilters = { from?: string; to?: string; status?: string; clientId?: string; userId?: string };

const parseDate = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : undefined);
const range = (f: ReportFilters) => {
  const from = parseDate(f.from);
  const to = parseDate(f.to);
  return from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;
};

/** Same as `range` but for timestamp columns: the "to" day is included in full. */
const dayRange = (f: ReportFilters) => {
  const from = parseDate(f.from);
  const to = parseDate(f.to);
  return from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 86_400_000) } : {}) } : undefined;
};

/** Default filters: AMC this calendar year; requests/quotations last 12 months. */
export function defaultFilters(type: ReportType): ReportFilters {
  const today = todayUTC();
  if (type === "amc") return { from: `${today.getUTCFullYear()}-01-01`, to: `${today.getUTCFullYear()}-12-31` };
  if (type === "statement") return {};
  const from = new Date(today.getTime() - 365 * 86_400_000);
  return { from: from.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
}

export async function buildReport(type: ReportType, filters: ReportFilters, lang: Lang): Promise<ReportResult> {
  const t = createTranslator({ locale: lang, messages: messagesFor(lang) });
  const settings = await getSettings();
  const cur = settings.defaultCurrency;
  const m = (v: number) => formatMoney(v, cur, lang);
  const name = (o: { nameAr: string; nameEn: string }) => (lang === "ar" ? o.nameAr : o.nameEn);

  // Human-readable filter line
  const parts: string[] = [];
  if (filters.from || filters.to) parts.push(`${filters.from ? formatDate(parseDate(filters.from)!, lang) : "…"} → ${filters.to ? formatDate(parseDate(filters.to)!, lang) : "…"}`);
  if (filters.clientId) {
    const c = await db.client.findUnique({ where: { id: filters.clientId }, select: { nameAr: true, nameEn: true } });
    if (c) parts.push(name(c));
  }
  if (filters.userId) {
    const u = await db.user.findUnique({ where: { id: filters.userId }, select: { name: true } });
    if (u) parts.push(u.name);
  }
  const statusLabel = (ns: string, s: string) => t(`${ns}.${s}` as never);

  if (type === "amc") {
    if (filters.status && ["PENDING", "PAID", "OVERDUE"].includes(filters.status)) parts.push(statusLabel("amcStatus", filters.status));
    const lines = await db.amcScheduleLine.findMany({
      where: {
        dueDate: range(filters),
        ...(filters.status && ["PENDING", "PAID", "OVERDUE"].includes(filters.status) ? { status: filters.status as "PENDING" } : {}),
        contract: {
          status: { not: "CANCELLED" },
          ...(filters.clientId ? { clientId: filters.clientId } : {}),
          ...(filters.userId ? { client: { accountManagerId: filters.userId } } : {}),
        },
      },
      orderBy: [{ dueDate: "asc" }],
      include: { contract: { select: { id: true, number: true, currency: true, client: { select: { nameAr: true, nameEn: true, accountManager: { select: { name: true } } } } } } },
    });
    const inCur = lines.filter((l) => l.contract.currency === cur);
    const sum = (arr: typeof lines, f: (l: (typeof lines)[number]) => number) => arr.reduce((s, l) => s + f(l), 0);
    const total = sum(inCur, (l) => Number(l.amount));
    const collected = sum(inCur.filter((l) => l.status === "PAID"), (l) => Number(l.paidAmount ?? l.amount));
    const overdue = sum(inCur.filter((l) => l.status === "OVERDUE"), (l) => Number(l.amount));
    return {
      type, currency: cur, empty: lines.length === 0,
      title: t("reports.amc"),
      filtersText: parts.join(" · "),
      summary: [
        [t("reports.count"), formatNumber(lines.length, lang)],
        [t("reports.total"), m(total)],
        [t("reports.collected"), m(collected)],
        [t("reports.outstanding"), m(total - collected)],
        [t("reports.overdue"), m(overdue)],
      ],
      tables: [
        {
          columns: [
            { key: "client", label: t("reports.client"), type: "text" },
            { key: "contract", label: t("reports.contract"), type: "text" },
            { key: "year", label: t("reports.year"), type: "number" },
            { key: "due", label: t("reports.dueDate"), type: "date" },
            { key: "status", label: t("reports.status"), type: "status" },
            { key: "amount", label: t("reports.amount"), type: "money", align: "end" },
            { key: "paidAt", label: t("reports.paidAt"), type: "date" },
            { key: "manager", label: t("reports.manager"), type: "text" },
          ],
          rows: lines.map((l) => ({
            client: name(l.contract.client),
            contract: l.contract.number,
            year: l.yearIndex,
            due: l.dueDate.toISOString(),
            status: statusLabel("amcStatus", l.status),
            amount: Number(l.amount),
            paidAt: l.paidAt?.toISOString() ?? null,
            manager: l.contract.client.accountManager?.name ?? "",
            _currency: l.contract.currency,
            _href: `/contracts/${l.contract.id}`,
            _tone: l.status === "OVERDUE" ? "red" : l.status === "PAID" ? "green" : "amber",
          })),
        },
      ],
    };
  }

  if (type === "requests") {
    if (filters.status) parts.push(statusLabel("requestStatus", filters.status));
    const reqs = await db.clientRequest.findMany({
      where: {
        requestDate: range(filters),
        ...(filters.status ? { status: filters.status as "NEW" } : {}),
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.userId ? { assigneeId: filters.userId } : {}),
      },
      orderBy: { requestDate: "desc" },
      include: { client: { select: { id: true, nameAr: true, nameEn: true } }, assignee: { select: { name: true } }, items: true, type: true },
    });
    const today = todayUTC();
    const rows = reqs.map((r) => ({ r, total: computeTotals(r.items, r.discount, r.vatPercent).total, overdue: !!r.dueDate && r.dueDate < today && (OPEN_REQUEST_STATUSES as readonly string[]).includes(r.status) }));
    const byStatus = new Map<string, { count: number; total: number }>();
    const byClient = new Map<string, { name: string; count: number; open: number; total: number }>();
    for (const { r, total } of rows) {
      const s = byStatus.get(r.status) ?? { count: 0, total: 0 };
      byStatus.set(r.status, { count: s.count + 1, total: s.total + (r.currency === cur ? total : 0) });
      const c = byClient.get(r.clientId) ?? { name: name(r.client), count: 0, open: 0, total: 0 };
      byClient.set(r.clientId, { ...c, count: c.count + 1, open: c.open + ((OPEN_REQUEST_STATUSES as readonly string[]).includes(r.status) ? 1 : 0), total: c.total + (r.currency === cur ? total : 0) });
    }
    return {
      type, currency: cur, empty: reqs.length === 0,
      title: t("reports.requests"),
      filtersText: parts.join(" · "),
      summary: [
        [t("reports.count"), formatNumber(reqs.length, lang)],
        [t("dashboard.openRequests"), formatNumber(rows.filter((x) => (OPEN_REQUEST_STATUSES as readonly string[]).includes(x.r.status)).length, lang)],
        [t("dashboard.overdueRequests"), formatNumber(rows.filter((x) => x.overdue).length, lang)],
        [t("reports.total"), m(rows.filter((x) => x.r.currency === cur).reduce((s, x) => s + x.total, 0))],
      ],
      tables: [
        {
          title: t("reports.byStatus"),
          columns: [
            { key: "status", label: t("reports.status"), type: "status" },
            { key: "count", label: t("reports.count"), type: "number", align: "end" },
            { key: "total", label: t("reports.total"), type: "money", align: "end" },
          ],
          rows: [...byStatus.entries()].map(([s, v]) => ({ status: statusLabel("requestStatus", s), count: v.count, total: v.total, _currency: cur })),
        },
        {
          title: t("reports.byClient"),
          columns: [
            { key: "client", label: t("reports.client"), type: "text" },
            { key: "count", label: t("reports.count"), type: "number", align: "end" },
            { key: "open", label: t("dashboard.openRequests"), type: "number", align: "end" },
            { key: "total", label: t("reports.total"), type: "money", align: "end" },
          ],
          rows: [...byClient.values()].sort((a, b) => b.total - a.total).map((v) => ({ client: v.name, count: v.count, open: v.open, total: v.total, _currency: cur })),
        },
        {
          title: t("reports.details"),
          columns: [
            { key: "number", label: t("reports.number"), type: "text" },
            { key: "title", label: t("reports.titleCol"), type: "text" },
            { key: "client", label: t("reports.client"), type: "text" },
            { key: "status", label: t("reports.status"), type: "status" },
            { key: "priority", label: t("reports.priority"), type: "text" },
            { key: "date", label: t("reports.date"), type: "date" },
            { key: "due", label: t("reports.dueDate"), type: "date" },
            { key: "assignee", label: t("reports.assignee"), type: "text" },
            { key: "total", label: t("reports.total"), type: "money", align: "end" },
          ],
          rows: rows.map(({ r, total, overdue }) => ({
            number: r.number, title: r.title, client: name(r.client), status: statusLabel("requestStatus", r.status),
            priority: t(`priority.${r.priority}` as never), date: r.requestDate.toISOString(), due: r.dueDate?.toISOString() ?? null,
            assignee: r.assignee?.name ?? "", total, _currency: r.currency, _href: `/requests/${r.id}`, _tone: overdue ? "red" : null,
          })),
        },
      ],
    };
  }

  if (type === "quotations") {
    if (filters.status) parts.push(statusLabel("quotationStatus", filters.status));
    const all = await db.quotation.findMany({
      where: {
        issueDate: range(filters),
        ...(filters.status ? { status: filters.status as "DRAFT" } : {}),
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
      },
      orderBy: [{ issueDate: "desc" }, { version: "desc" }],
      include: { client: { select: { nameAr: true, nameEn: true } }, items: true },
    });
    // Latest version of each quotation number only (older versions are superseded).
    const seen = new Set<string>();
    const qs = all.filter((q) => (seen.has(q.number) ? false : (seen.add(q.number), true)));
    const withTotal = qs.map((q) => ({ q, total: computeTotals(q.items, q.discount, q.vatPercent).total }));
    const byStatus = new Map<string, { count: number; total: number }>();
    for (const { q, total } of withTotal) {
      const s = byStatus.get(q.status) ?? { count: 0, total: 0 };
      byStatus.set(q.status, { count: s.count + 1, total: s.total + (q.currency === cur ? total : 0) });
    }
    const acc = byStatus.get("ACCEPTED")?.count ?? 0;
    const rej = byStatus.get("REJECTED")?.count ?? 0;
    return {
      type, currency: cur, empty: qs.length === 0,
      title: t("reports.quotations"),
      filtersText: parts.join(" · "),
      summary: [
        [t("reports.count"), formatNumber(qs.length, lang)],
        [t("reports.total"), m(withTotal.filter((x) => x.q.currency === cur).reduce((s, x) => s + x.total, 0))],
        [t("quotationStatus.ACCEPTED"), m(byStatus.get("ACCEPTED")?.total ?? 0)],
        [t("reports.acceptanceRate"), acc + rej ? `${formatNumber(Math.round((acc / (acc + rej)) * 100), lang)}%` : "—"],
      ],
      tables: [
        {
          title: t("reports.byStatus"),
          columns: [
            { key: "status", label: t("reports.status"), type: "status" },
            { key: "count", label: t("reports.count"), type: "number", align: "end" },
            { key: "total", label: t("reports.total"), type: "money", align: "end" },
          ],
          rows: [...byStatus.entries()].map(([s, v]) => ({ status: statusLabel("quotationStatus", s), count: v.count, total: v.total, _currency: cur })),
        },
        {
          title: t("reports.details"),
          columns: [
            { key: "number", label: t("reports.number"), type: "text" },
            { key: "client", label: t("reports.client"), type: "text" },
            { key: "title", label: t("reports.titleCol"), type: "text" },
            { key: "status", label: t("reports.status"), type: "status" },
            { key: "date", label: t("reports.date"), type: "date" },
            { key: "valid", label: t("reports.validUntil"), type: "date" },
            { key: "total", label: t("reports.total"), type: "money", align: "end" },
          ],
          rows: withTotal.map(({ q, total }) => ({
            number: q.version > 1 ? `${q.number} v${q.version}` : q.number, client: name(q.client), title: q.title ?? "",
            status: statusLabel("quotationStatus", q.status), date: q.issueDate.toISOString(), valid: q.validUntil.toISOString(),
            total, _currency: q.currency, _href: `/quotations/${q.id}`,
            _tone: q.status === "ACCEPTED" ? "green" : q.status === "REJECTED" ? "red" : null,
          })),
        },
      ],
    };
  }

  // ---- Delivery: on-time vs late, estimated vs actual hours, due-date changes ----
  if (type === "delivery") {
    const delivered = await db.deliveryTask.findMany({
      where: {
        deliveredAt: dayRange(filters) ?? { not: null },
        project: { status: { not: "CANCELLED" }, ...(filters.clientId ? { clientId: filters.clientId } : {}) },
        ...(filters.userId ? { assignees: { some: { userId: filters.userId } } } : {}),
      },
      orderBy: { deliveredAt: "desc" },
      include: {
        project: { select: { id: true, number: true, title: true, client: { select: { id: true, nameAr: true, nameEn: true } } } },
        assignees: { select: { userId: true, user: { select: { name: true } } } },
        timeLogs: { select: { userId: true, hours: true } },
      },
    });
    const changes = await db.taskDueDateChange.findMany({
      where: {
        createdAt: dayRange(filters),
        task: {
          project: { status: { not: "CANCELLED" }, ...(filters.clientId ? { clientId: filters.clientId } : {}) },
          ...(filters.userId ? { assignees: { some: { userId: filters.userId } } } : {}),
        },
      },
      orderBy: { createdAt: "desc" },
      include: { changedBy: { select: { name: true } }, task: { select: { id: true, title: true, project: { select: { number: true } } } } },
    });

    const hours = (logs: { hours: unknown }[]) => logs.reduce((a, l) => a + Number(l.hours), 0);
    const kpi = (tk: (typeof delivered)[number], est = Number(tk.estimatedHours ?? 0), act = hours(tk.timeLogs)): KpiItem => ({
      deliveredAt: tk.deliveredAt, originalDueDate: tk.originalDueDate, dueDate: tk.dueDate, estimated: est, actual: act,
    });
    const total = summarize(delivered.map((tk) => kpi(tk)));
    const pct = (v: number | null) => (v == null ? "—" : `${formatNumber(v, lang)}%`);
    const h = (v: number) => t("reports.hoursValue", { hours: formatNumber(v, lang, undefined, 1) });
    const toneFor = (r: number | null) => (r == null ? null : r >= 80 ? "green" : r < 60 ? "red" : null);
    const groupCols = (first: { key: string; label: string }) => [
      { ...first, type: "text" as const },
      { key: "delivered", label: t("reports.deliveredCount"), type: "number" as const, align: "end" as const },
      { key: "onTime", label: t("reports.onTime"), type: "number" as const, align: "end" as const },
      { key: "late", label: t("reports.late"), type: "number" as const, align: "end" as const },
      { key: "rate", label: t("reports.onTimeRate"), type: "text" as const, align: "end" as const },
      { key: "estimated", label: t("reports.estimatedHours"), type: "number" as const, align: "end" as const },
      { key: "actual", label: t("reports.actualHours"), type: "number" as const, align: "end" as const },
    ];
    const groupRow = (g: KpiSummary & { label: string }, href?: string) => ({
      name: g.label, delivered: g.delivered, onTime: g.onTime, late: g.late, rate: pct(g.rate), estimated: g.estimated, actual: g.actual,
      _href: href ?? null, _tone: toneFor(g.rate),
    });
    // Per person: each assignee gets an equal share of the estimate and the hours they logged themselves.
    const byPerson = summarizeBy(delivered, (tk) =>
      tk.assignees
        .filter((a) => !filters.userId || a.userId === filters.userId)
        .map((a) => ({ key: a.userId, label: a.user.name, item: kpi(tk, Number(tk.estimatedHours ?? 0) / tk.assignees.length, hours(tk.timeLogs.filter((l) => l.userId === a.userId))) })),
    );
    const byClient = summarizeBy(delivered, (tk) => [{ key: tk.project.client.id, label: name(tk.project.client), item: kpi(tk) }]);
    const byProject = summarizeBy(delivered, (tk) => [{ key: tk.project.id, label: `${tk.project.number} · ${tk.project.title}`, item: kpi(tk) }]);
    const changeCount = changes.length;

    return {
      type, currency: cur, empty: delivered.length === 0 && changeCount === 0,
      title: t("reports.delivery"),
      filtersText: parts.join(" · "),
      summary: [
        [t("reports.deliveredCount"), formatNumber(total.delivered, lang)],
        [t("reports.onTimeRate"), pct(total.rate)],
        [t("reports.late"), formatNumber(total.late, lang)],
        [t("reports.estimatedVsActual"), `${h(total.estimated)} / ${h(total.actual)}`],
        [t("reports.dueChanges"), formatNumber(changeCount, lang)],
      ],
      tables: [
        { title: t("reports.byPerson"), columns: groupCols({ key: "name", label: t("reports.person") }), rows: byPerson.map((g) => groupRow(g)) },
        { title: t("reports.byClient"), columns: groupCols({ key: "name", label: t("reports.client") }), rows: byClient.map((g) => groupRow(g, `/clients/${g.key}`)) },
        { title: t("reports.byProject"), columns: groupCols({ key: "name", label: t("reports.project") }), rows: byProject.map((g) => groupRow(g, `/delivery/${g.key}`)) },
        {
          title: t("reports.deliveredTasks"),
          columns: [
            { key: "task", label: t("reports.task"), type: "text" },
            { key: "project", label: t("reports.project"), type: "text" },
            { key: "people", label: t("reports.assignee"), type: "text" },
            { key: "original", label: t("reports.originalDue"), type: "date" },
            { key: "delivered", label: t("reports.deliveredOn"), type: "date" },
            { key: "result", label: t("reports.result"), type: "status" },
            { key: "estimated", label: t("reports.estimatedHours"), type: "number", align: "end" },
            { key: "actual", label: t("reports.actualHours"), type: "number", align: "end" },
          ],
          rows: delivered.map((tk) => {
            const ok = deliveredOnTime(tk);
            return {
              task: tk.title, project: tk.project.number, people: tk.assignees.map((a) => a.user.name).join(", "),
              original: (tk.originalDueDate ?? tk.dueDate)?.toISOString() ?? null, delivered: tk.deliveredAt!.toISOString(),
              result: ok == null ? t("reports.noTarget") : ok ? t("reports.onTime") : t("reports.late"),
              estimated: tk.estimatedHours == null ? null : Number(tk.estimatedHours), actual: Math.round(hours(tk.timeLogs) * 100) / 100,
              _href: `/tasks/${tk.id}`, _tone: ok == null ? "slate" : ok ? "green" : "red",
            };
          }),
        },
        {
          title: t("reports.dueChangeLog"),
          columns: [
            { key: "when", label: t("reports.changedOn"), type: "date" },
            { key: "task", label: t("reports.task"), type: "text" },
            { key: "project", label: t("reports.project"), type: "text" },
            { key: "by", label: t("reports.changedBy"), type: "text" },
            { key: "from", label: t("reports.fromDate"), type: "date" },
            { key: "to", label: t("reports.toDate"), type: "date" },
            { key: "reason", label: t("reports.reason"), type: "text" },
          ],
          rows: changes.map((c) => ({
            when: c.createdAt.toISOString(), task: c.task.title, project: c.task.project.number, by: c.changedBy?.name ?? "—",
            from: c.oldDate?.toISOString() ?? null, to: c.newDate?.toISOString() ?? null, reason: c.reason, _href: `/tasks/${c.task.id}`,
          })),
        },
      ],
    };
  }

  // ---- Client statement --------------------------------------------------
  if (!filters.clientId) return { type, currency: cur, empty: true, title: t("reports.statement"), filtersText: "", summary: [], tables: [] };
  const c = await db.client.findUnique({
    where: { id: filters.clientId },
    include: {
      contracts: { orderBy: { contractDate: "asc" }, include: { amcLines: { orderBy: { yearIndex: "asc" } } } },
      requests: { orderBy: { requestDate: "desc" }, include: { items: true } },
      quotations: { orderBy: [{ issueDate: "desc" }, { version: "desc" }], include: { items: true } },
    },
  });
  if (!c) return { type, currency: cur, empty: true, title: t("reports.statement"), filtersText: "", summary: [], tables: [] };
  const today = todayUTC();
  const contracts = c.contracts.filter((k) => k.status !== "CANCELLED");
  const lines = contracts.flatMap((k) => k.amcLines.map((l) => ({ ...l, contract: k })));
  const inCur = <T extends { currency: string }>(x: T) => x.currency === cur;
  const billed = lines.filter((l) => inCur(l.contract) && l.dueDate <= today);
  const collected = lines.filter((l) => inCur(l.contract) && l.status === "PAID").reduce((s, l) => s + Number(l.paidAmount ?? l.amount), 0);
  const seen = new Set<string>();
  const quotes = c.quotations.filter((q) => (seen.has(q.number) ? false : (seen.add(q.number), true)));
  return {
    type, currency: cur, empty: false,
    title: `${t("reports.statement")} — ${name(c)}`,
    filtersText: `${c.code} · ${t("reports.generatedAt", { date: formatDate(today, lang) })}`,
    summary: [
      [t("clients.totalContractValue"), m(contracts.filter(inCur).reduce((s, k) => s + Number(k.value), 0))],
      [t("reports.amcLines"), m(billed.reduce((s, l) => s + Number(l.amount), 0))],
      [t("reports.collected"), m(collected)],
      [t("reports.outstanding"), m(billed.filter((l) => l.status !== "PAID").reduce((s, l) => s + Number(l.amount), 0))],
    ],
    tables: [
      {
        title: t("reports.contracts"),
        columns: [
          { key: "number", label: t("reports.number"), type: "text" },
          { key: "date", label: t("reports.date"), type: "date" },
          { key: "status", label: t("reports.status"), type: "status" },
          { key: "value", label: t("reports.value"), type: "money", align: "end" },
        ],
        rows: c.contracts.map((k) => ({ number: k.number, date: k.contractDate.toISOString(), status: statusLabel("contractStatus", k.status), value: Number(k.value), _currency: k.currency, _href: `/contracts/${k.id}` })),
      },
      {
        title: t("reports.amcLines"),
        columns: [
          { key: "contract", label: t("reports.contract"), type: "text" },
          { key: "year", label: t("reports.year"), type: "number" },
          { key: "due", label: t("reports.dueDate"), type: "date" },
          { key: "status", label: t("reports.status"), type: "status" },
          { key: "amount", label: t("reports.amount"), type: "money", align: "end" },
          { key: "paidAt", label: t("reports.paidAt"), type: "date" },
        ],
        rows: lines.map((l) => ({
          contract: l.contract.number, year: l.yearIndex, due: l.dueDate.toISOString(), status: statusLabel("amcStatus", l.status),
          amount: Number(l.amount), paidAt: l.paidAt?.toISOString() ?? null, _currency: l.contract.currency,
          _tone: l.status === "OVERDUE" ? "red" : l.status === "PAID" ? "green" : null,
        })),
      },
      {
        title: t("reports.requests"),
        columns: [
          { key: "number", label: t("reports.number"), type: "text" },
          { key: "title", label: t("reports.titleCol"), type: "text" },
          { key: "status", label: t("reports.status"), type: "status" },
          { key: "date", label: t("reports.date"), type: "date" },
          { key: "total", label: t("reports.total"), type: "money", align: "end" },
        ],
        rows: c.requests.map((r) => ({ number: r.number, title: r.title, status: statusLabel("requestStatus", r.status), date: r.requestDate.toISOString(), total: computeTotals(r.items, r.discount, r.vatPercent).total, _currency: r.currency, _href: `/requests/${r.id}` })),
      },
      {
        title: t("reports.quotations"),
        columns: [
          { key: "number", label: t("reports.number"), type: "text" },
          { key: "status", label: t("reports.status"), type: "status" },
          { key: "date", label: t("reports.date"), type: "date" },
          { key: "total", label: t("reports.total"), type: "money", align: "end" },
        ],
        rows: quotes.map((q) => ({ number: q.version > 1 ? `${q.number} v${q.version}` : q.number, status: statusLabel("quotationStatus", q.status), date: q.issueDate.toISOString(), total: computeTotals(q.items, q.discount, q.vatPercent).total, _currency: q.currency, _href: `/quotations/${q.id}` })),
      },
    ],
  };
}

/** Format one cell for display (screen + PDF). */
export function formatCell(col: ReportColumn, row: ReportRow, lang: Lang): string {
  const v = row[col.key];
  if (v === null || v === undefined || v === "") return "—";
  if (col.type === "money") return formatMoney(Number(v), row._currency ?? "EGP", lang);
  if (col.type === "date") return formatDate(String(v), lang);
  if (col.type === "number") return formatNumber(Number(v), lang);
  return String(v);
}

export function parseFilters(sp: Record<string, string | string[] | undefined>): ReportFilters {
  const g = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  return { from: g("from"), to: g("to"), status: g("status"), clientId: g("clientId"), userId: g("userId") };
}
