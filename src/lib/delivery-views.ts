/**
 * Calendar & workload calculations for the delivery views (pure, unit-tested).
 *
 * Business calendar (Egypt): weeks start on SATURDAY; working days are
 * Sunday–Thursday (Friday/Saturday weekend).
 */
import { round2 } from "./amc/engine";
import { isDone } from "./delivery";

const DAY = 86_400_000;
export const utcDay = (d: Date | string) => {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
};
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
export const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Saturday on or before the date. */
export function startOfWeek(d: Date) {
  const x = utcDay(d);
  return addDays(x, -((x.getUTCDay() + 1) % 7)); // Sat=6 → 0, Sun=0 → 1, …
}

/** Sun–Thu are working days. */
export const isWorkingDay = (d: Date) => d.getUTCDay() <= 4;

export function workingDaysBetween(from: Date, to: Date) {
  const out: Date[] = [];
  for (let d = utcDay(from); d <= utcDay(to); d = addDays(d, 1)) if (isWorkingDay(d)) out.push(d);
  return out;
}

/** 6×7 grid of dates (Saturday-first) covering the given month. */
export function monthGrid(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export type WorkloadTask = {
  id: string;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  loggedHours: number;
  assignees: { userId: string }[];
};

export type WorkloadCell = { hours: number; taskIds: string[] };

/**
 * Hours per person per week for `weeks` weeks starting at the week of `today`.
 *  remaining = max(0, estimate − logged), split equally between assignees,
 *  spread evenly over working days from max(start, today) to the due date.
 *  Overdue work lands in the current week. Tasks without a due date or estimate
 *  are listed (taskIds) but add no hours. Done tasks are ignored.
 */
export function computeWorkload(tasks: WorkloadTask[], today: Date, weeks = 8) {
  const week0 = startOfWeek(today);
  const weekStarts = Array.from({ length: weeks }, (_, i) => addDays(week0, i * 7));
  const horizonEnd = addDays(week0, weeks * 7 - 1);
  const byUser = new Map<string, WorkloadCell[]>();
  const unscheduled = new Map<string, string[]>();
  const cells = (u: string) => {
    if (!byUser.has(u)) byUser.set(u, weekStarts.map(() => ({ hours: 0, taskIds: [] })));
    return byUser.get(u)!;
  };
  const weekIndex = (d: Date) => Math.floor((utcDay(d).getTime() - week0.getTime()) / (7 * DAY));

  for (const t of tasks) {
    if (isDone(t.status) || !t.assignees.length) continue;
    const share = Math.max(0, (t.estimatedHours ?? 0) - t.loggedHours) / t.assignees.length;
    if (!t.dueDate) {
      for (const a of t.assignees) unscheduled.set(a.userId, [...(unscheduled.get(a.userId) ?? []), t.id]);
      continue;
    }
    const due = utcDay(t.dueDate);
    const from = t.startDate && utcDay(t.startDate) > utcDay(today) ? utcDay(t.startDate) : utcDay(today);
    // Overdue (or due today/before start): all remaining work this week.
    const days = due < from ? [] : workingDaysBetween(from, due);
    for (const a of t.assignees) {
      const row = cells(a.userId);
      if (!days.length) {
        const w = Math.max(0, Math.min(weeks - 1, weekIndex(due < utcDay(today) ? today : due)));
        row[w].hours = round2(row[w].hours + share);
        if (!row[w].taskIds.includes(t.id)) row[w].taskIds.push(t.id);
        continue;
      }
      const perDay = share / days.length;
      for (const d of days) {
        if (d > horizonEnd) break;
        const w = weekIndex(d);
        if (w < 0 || w >= weeks) continue;
        row[w].hours = round2(row[w].hours + perDay);
        if (!row[w].taskIds.includes(t.id)) row[w].taskIds.push(t.id);
      }
    }
  }
  return { weekStarts: weekStarts.map(iso), byUser, unscheduled };
}

/** Load level for a week vs capacity: ok < 80% ≤ high ≤ 100% < over. */
export function loadLevel(hours: number, capacity: number): "none" | "ok" | "high" | "over" {
  if (hours <= 0) return "none";
  if (capacity <= 0 || hours > capacity) return "over";
  return hours >= capacity * 0.8 ? "high" : "ok";
}
