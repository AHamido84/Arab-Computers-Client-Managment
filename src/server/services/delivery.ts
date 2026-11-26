import "server-only";
import { db } from "@/lib/db";
import { todayUTC } from "@/lib/format";
import { lineTotal } from "@/lib/totals";
import { draftKey, isDone, isTaskOverdue, projectProgress, type DraftTask } from "@/lib/delivery";
import { can } from "@/server/auth-guard";
import type { Role } from "@/generated/prisma/enums";

type Viewer = { id: string; role: Role };
const toDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const n = (v: unknown) => (v == null ? null : Number(v));

// ---------------------------------------------------------------------------
// Access rules
// ---------------------------------------------------------------------------

/** Who may see a task: managers & read-only roles see all; team members only theirs. */
export async function taskAccess(taskId: string, user: Viewer) {
  const task = await db.deliveryTask.findUnique({
    where: { id: taskId },
    select: {
      id: true, projectId: true, project: { select: { clientId: true } },
      assignees: { select: { userId: true, role: true } }, watchers: { select: { userId: true } },
    },
  });
  if (!task) return null;
  const assignee = task.assignees.find((a) => a.userId === user.id);
  const watcher = task.watchers.some((w) => w.userId === user.id);
  const manager = can(user.role, "manageDelivery");
  return {
    task,
    canView: manager || can(user.role, "read") || !!assignee || watcher,
    /** status, progress, checklist, time logs, files */
    canWork: manager || !!assignee,
    canComment: manager || !!assignee || watcher,
    canChangeDue: manager || assignee?.role === "LEAD",
    canManage: manager,
    showPrice: can(user.role, "read"),
  };
}

// ---------------------------------------------------------------------------
// Drafts for the confirmation screen
// ---------------------------------------------------------------------------

export async function draftsFromQuotation(quotationId: string) {
  const q = await db.quotation.findUnique({
    where: { id: quotationId },
    include: {
      client: { select: { id: true, nameAr: true, nameEn: true } },
      items: { orderBy: { sortOrder: "asc" }, include: { request: { select: { id: true, estimatedHours: true, priority: true } } } },
    },
  });
  if (!q) return null;
  // Distribute a request's estimated hours over its quotation lines, by line value.
  const byRequest = new Map<string, number>();
  for (const i of q.items) if (i.requestId) byRequest.set(i.requestId, (byRequest.get(i.requestId) ?? 0) + lineTotal(i));
  const tasks: DraftTask[] = q.items.map((i) => {
    const total = i.requestId ? byRequest.get(i.requestId) ?? 0 : 0;
    const reqHours = n(i.request?.estimatedHours);
    const hours = reqHours != null && total > 0 ? Math.round((reqHours * lineTotal(i)) / total * 100) / 100 : null;
    return {
      key: draftKey(),
      title: i.title,
      scope: i.scope ?? "",
      price: lineTotal(i),
      estimatedHours: hours,
      startDate: toDate(i.startDate),
      dueDate: toDate(i.dueDate),
      requestId: i.requestId,
      quotationItemId: i.id,
      assignees: [],
      watchers: [],
    };
  });
  return {
    source: "QUOTATION" as const,
    sourceId: q.id,
    approved: q.status === "ACCEPTED",
    reference: q.version > 1 ? `${q.number} v${q.version}` : q.number,
    client: q.client,
    currency: q.currency,
    title: q.title ?? (q.version > 1 ? `${q.number} v${q.version}` : q.number),
    tasks,
  };
}

export async function draftsFromContract(contractId: string) {
  const c = await db.contract.findUnique({
    where: { id: contractId },
    include: { client: { select: { id: true, nameAr: true, nameEn: true, preferredLang: true } }, products: { include: { product: true } } },
  });
  if (!c) return null;
  const count = Math.max(1, c.products.length);
  const share = Math.round((Number(c.value) / count) * 100) / 100;
  const tasks: DraftTask[] = c.products.map((p) => ({
    key: draftKey(),
    title: c.client.preferredLang === "ar" ? `تنفيذ — ${p.product.labelAr}` : `Implementation — ${p.product.labelEn}`,
    scope: c.title ?? "",
    price: share,
    estimatedHours: null,
    startDate: toDate(c.startDate),
    dueDate: toDate(c.endDate),
    requestId: null,
    quotationItemId: null,
    assignees: [],
    watchers: [],
  }));
  return {
    source: "CONTRACT" as const,
    sourceId: c.id,
    approved: c.status === "ACTIVE",
    reference: c.number,
    client: c.client,
    currency: c.currency,
    title: c.title ?? c.number,
    tasks,
  };
}

/** Accepted quotations / recently activated contracts that have no delivery project yet. */
export async function awaitingSetup() {
  const since = new Date(todayUTC().getTime() - 180 * 86_400_000);
  const [quotes, contracts] = await Promise.all([
    db.quotation.findMany({
      where: { status: "ACCEPTED", deliveryProjects: { none: {} }, OR: [{ decidedAt: { gte: since } }, { decidedAt: null, issueDate: { gte: since } }] },
      select: { id: true, number: true, version: true, title: true, client: { select: { nameAr: true, nameEn: true } } },
      orderBy: { decidedAt: "desc" },
    }),
    db.contract.findMany({
      where: { status: "ACTIVE", deliveryProjects: { none: {} }, startDate: { gte: since } },
      select: { id: true, number: true, title: true, client: { select: { nameAr: true, nameEn: true } } },
      orderBy: { startDate: "desc" },
    }),
  ]);
  return [
    ...quotes.map((q) => ({ kind: "quotation" as const, id: q.id, reference: q.version > 1 ? `${q.number} v${q.version}` : q.number, title: q.title, client: q.client })),
    ...contracts.map((c) => ({ kind: "contract" as const, id: c.id, reference: c.number, title: c.title, client: c.client })),
  ];
}

// ---------------------------------------------------------------------------
// Lists & details
// ---------------------------------------------------------------------------

export async function listProjects() {
  const today = todayUTC();
  const rows = await db.deliveryProject.findMany({
    orderBy: [{ status: "asc" }, { targetDate: "asc" }],
    include: {
      client: { select: { id: true, nameAr: true, nameEn: true } },
      quotation: { select: { id: true, number: true, version: true } },
      contract: { select: { id: true, number: true } },
      tasks: { select: { status: true, progress: true, estimatedHours: true, dueDate: true } },
    },
  });
  return rows.map((p) => {
    const tasks = p.tasks.map((t) => ({ ...t, estimatedHours: n(t.estimatedHours) }));
    return {
      id: p.id,
      number: p.number,
      title: p.title,
      status: p.status,
      client: p.client,
      reference: p.quotation ? (p.quotation.version > 1 ? `${p.quotation.number} v${p.quotation.version}` : p.quotation.number) : p.contract?.number ?? null,
      source: p.source,
      startDate: p.startDate?.toISOString() ?? null,
      targetDate: p.targetDate?.toISOString() ?? null,
      progress: projectProgress(tasks),
      tasksTotal: tasks.length,
      tasksDone: tasks.filter((t) => isDone(t.status)).length,
      overdue: tasks.filter((t) => isTaskOverdue(t, today)).length,
      late: !!p.targetDate && p.targetDate < today && !["DELIVERED", "CLIENT_ACCEPTED", "CANCELLED"].includes(p.status),
    };
  });
}
export type ProjectRow = Awaited<ReturnType<typeof listProjects>>[number];

const taskInclude = {
  project: { select: { id: true, number: true, title: true, client: { select: { id: true, nameAr: true, nameEn: true } } } },
  assignees: { select: { userId: true, role: true, user: { select: { name: true } } }, orderBy: { role: "asc" as const } },
  timeLogs: { select: { hours: true } },
  checklist: { select: { done: true } },
};

type TaskWithInclude = Awaited<ReturnType<typeof db.deliveryTask.findMany<{ include: typeof taskInclude }>>>[number];

function toTaskRow(t: TaskWithInclude, today: Date, showPrice: boolean) {
  return {
    id: t.id,
    title: t.title,
    project: t.project,
    status: t.status,
    priority: t.priority,
    progress: isDone(t.status) ? 100 : t.progress,
    startDate: t.startDate?.toISOString() ?? null,
    dueDate: t.dueDate?.toISOString() ?? null,
    originalDueDate: t.originalDueDate?.toISOString() ?? null,
    deliveredAt: t.deliveredAt?.toISOString() ?? null,
    estimatedHours: n(t.estimatedHours),
    loggedHours: Math.round(t.timeLogs.reduce((s, l) => s + Number(l.hours), 0) * 100) / 100,
    price: showPrice ? n(t.price) : null,
    currency: t.currency,
    assignees: t.assignees.map((a) => ({ userId: a.userId, role: a.role, name: a.user.name })),
    checklist: { done: t.checklist.filter((c) => c.done).length, total: t.checklist.length },
    overdue: isTaskOverdue(t, today),
    sortOrder: t.sortOrder,
  };
}
export type TaskRow = ReturnType<typeof toTaskRow>;

/** Tasks visible to a user. Team members only get tasks they're assigned to or watch. */
export async function listTasks(user: Viewer, where: { projectId?: string; mine?: boolean } = {}) {
  const restrict = !can(user.role, "read") || where.mine;
  const rows = await db.deliveryTask.findMany({
    where: {
      ...(where.projectId ? { projectId: where.projectId } : {}),
      ...(restrict ? { OR: [{ assignees: { some: { userId: user.id } } }, ...(where.mine ? [] : [{ watchers: { some: { userId: user.id } } }])] } : {}),
      project: { status: { not: "CANCELLED" } },
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }],
    include: taskInclude,
  });
  const today = todayUTC();
  return rows.map((t) => toTaskRow(t, today, can(user.role, "read")));
}

export async function getProject(id: string) {
  return db.deliveryProject.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, nameAr: true, nameEn: true, preferredLang: true } },
      quotation: { select: { id: true, number: true, version: true } },
      contract: { select: { id: true, number: true } },
      createdBy: { select: { name: true } },
    },
  });
}

export async function getTaskDetail(id: string) {
  return db.deliveryTask.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, number: true, title: true, status: true, client: { select: { id: true, nameAr: true, nameEn: true } } } },
      request: { select: { id: true, number: true, title: true } },
      assignees: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { role: "asc" } },
      watchers: { include: { user: { select: { id: true, name: true } } } },
      checklist: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      comments: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true } } } },
      timeLogs: { orderBy: [{ date: "desc" }, { createdAt: "desc" }], include: { user: { select: { id: true, name: true } } } },
      dueDateChanges: { orderBy: { createdAt: "desc" }, include: { changedBy: { select: { name: true } } } },
    },
  });
}

/** People who can be assigned to tasks (active admins, managers, team members). */
export async function getDeliveryPeople() {
  return db.user.findMany({
    where: { active: true, role: { in: ["ADMIN", "ACCOUNT_MANAGER", "TEAM_MEMBER"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });
}
