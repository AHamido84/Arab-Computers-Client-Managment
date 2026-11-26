/**
 * Delivery-tracking rules (pure, unit-tested).
 */
import { round2 } from "./amc/engine";

export const TASK_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "IN_REVIEW", "DELIVERED", "CLIENT_ACCEPTED", "ON_HOLD"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const DONE_STATUSES: readonly TaskStatus[] = ["DELIVERED", "CLIENT_ACCEPTED"];
export const isDone = (s: string) => (DONE_STATUSES as readonly string[]).includes(s);

const day = (d: Date | string) => {
  const x = new Date(d);
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
};

/**
 * Project progress = tasks' progress weighted by estimated hours (equal weights
 * when no task has hours). Delivered / accepted tasks count as 100%.
 */
export function projectProgress(tasks: { status: string; progress: number; estimatedHours?: number | null }[]) {
  if (!tasks.length) return 0;
  const useHours = tasks.some((t) => (t.estimatedHours ?? 0) > 0);
  let total = 0;
  let done = 0;
  for (const t of tasks) {
    const w = useHours ? Math.max(0, t.estimatedHours ?? 0) : 1;
    const p = isDone(t.status) ? 100 : Math.min(100, Math.max(0, t.progress));
    total += w;
    done += w * p;
  }
  return total ? Math.round(done / total) : 0;
}

/** Open task whose due date is before today. */
export function isTaskOverdue(t: { status: string; dueDate: Date | string | null }, today: Date) {
  return !!t.dueDate && !isDone(t.status) && day(t.dueDate) < day(today);
}

/**
 * On-time = delivered on or before the ORIGINAL due date (falls back to the
 * current due date). Returns null when not delivered yet or no date was set.
 */
export function deliveredOnTime(t: { deliveredAt: Date | string | null; originalDueDate: Date | string | null; dueDate: Date | string | null }) {
  const target = t.originalDueDate ?? t.dueDate;
  if (!t.deliveredAt || !target) return null;
  return day(t.deliveredAt) <= day(target);
}

/** Final delivery date of a project = latest task due date. */
export function latestDueDate(tasks: { dueDate: string | null | undefined }[]) {
  const ds = tasks.map((t) => t.dueDate).filter((d): d is string => !!d).sort();
  return ds.length ? ds[ds.length - 1] : null;
}

// ---------------------------------------------------------------------------
// Draft tasks on the confirmation screen
// ---------------------------------------------------------------------------

export type DraftAssignee = { userId: string; role: "LEAD" | "MEMBER" };
export type DraftTask = {
  key: string;
  title: string;
  scope: string;
  price: number | null;
  estimatedHours: number | null;
  startDate: string;
  dueDate: string;
  requestId: string | null;
  quotationItemId: string | null;
  assignees: DraftAssignee[];
  watchers: string[];
};

let seq = 0;
export const draftKey = () => `d${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Split a task into `parts` equal pieces (price & hours divided, remainder on the last). */
export function splitDraft(t: DraftTask, parts = 2): DraftTask[] {
  const n = Math.max(2, Math.trunc(parts));
  const share = (v: number | null) => {
    if (v == null) return Array(n).fill(null) as (number | null)[];
    const each = round2(v / n);
    return Array.from({ length: n }, (_, i) => (i === n - 1 ? round2(v - each * (n - 1)) : each));
  };
  const prices = share(t.price);
  const hours = share(t.estimatedHours);
  return Array.from({ length: n }, (_, i) => ({
    ...t,
    key: draftKey(),
    title: `${t.title} (${i + 1}/${n})`,
    price: prices[i],
    estimatedHours: hours[i],
    assignees: t.assignees.map((a) => ({ ...a })),
    watchers: [...t.watchers],
  }));
}

/** Merge tasks into one: titles/scopes joined, price & hours summed, earliest start, latest due. */
export function mergeDrafts(tasks: DraftTask[]): DraftTask {
  if (tasks.length < 2) throw new Error("merge needs at least two tasks");
  const sum = (f: (t: DraftTask) => number | null) => (tasks.some((t) => f(t) != null) ? round2(tasks.reduce((s, t) => s + (f(t) ?? 0), 0)) : null);
  const starts = tasks.map((t) => t.startDate).filter(Boolean).sort();
  const dues = tasks.map((t) => t.dueDate).filter(Boolean).sort();
  const assignees = new Map<string, DraftAssignee>();
  for (const a of tasks.flatMap((t) => t.assignees)) {
    const cur = assignees.get(a.userId);
    assignees.set(a.userId, { userId: a.userId, role: cur?.role === "LEAD" || a.role === "LEAD" ? "LEAD" : "MEMBER" });
  }
  // Keep a single lead (the first one found).
  let leadSeen = false;
  const merged = [...assignees.values()].map((a) => {
    if (a.role !== "LEAD") return a;
    if (leadSeen) return { ...a, role: "MEMBER" as const };
    leadSeen = true;
    return a;
  });
  const ids = (f: (t: DraftTask) => string | null) => [...new Set(tasks.map(f).filter(Boolean))];
  return {
    key: draftKey(),
    title: tasks.map((t) => t.title).join(" + "),
    scope: [...new Set(tasks.map((t) => t.scope.trim()).filter(Boolean))].join("\n\n"),
    price: sum((t) => t.price),
    estimatedHours: sum((t) => t.estimatedHours),
    startDate: starts[0] ?? "",
    dueDate: dues[dues.length - 1] ?? "",
    requestId: ids((t) => t.requestId).length === 1 ? ids((t) => t.requestId)[0] : null,
    quotationItemId: null,
    assignees: merged,
    watchers: [...new Set(tasks.flatMap((t) => t.watchers))].filter((w) => !assignees.has(w)),
  };
}
