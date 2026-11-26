/**
 * Who hears about task events, and how the daily delivery digest is bucketed
 * (pure, unit-tested). The person who did the action is never notified.
 *
 *  TASK_ASSIGNED  → the people just added
 *  TASK_MENTION   → the people @mentioned
 *  TASK_DELIVERED → task lead, watchers, client's account manager
 *  TASK_DUE_CHANGED → all assignees, watchers, client's account manager
 *  TASK_DUE / TASK_OVERDUE (daily job) → assignees (+ account manager when overdue)
 */
export type TaskEventKind = "TASK_ASSIGNED" | "TASK_DELIVERED" | "TASK_DUE_CHANGED" | "TASK_MENTION";

export type TaskPeople = {
  assignees: { userId: string; role: "LEAD" | "MEMBER" }[];
  watchers: string[];
  accountManagerId: string | null;
};

export function eventRecipients(kind: TaskEventKind, people: TaskPeople, opts: { actorId?: string; userIds?: string[] } = {}) {
  let ids: (string | null)[];
  switch (kind) {
    case "TASK_ASSIGNED":
    case "TASK_MENTION":
      ids = opts.userIds ?? [];
      break;
    case "TASK_DELIVERED":
      ids = [...people.assignees.filter((a) => a.role === "LEAD").map((a) => a.userId), ...people.watchers, people.accountManagerId];
      break;
    case "TASK_DUE_CHANGED":
      ids = [...people.assignees.map((a) => a.userId), ...people.watchers, people.accountManagerId];
      break;
  }
  return [...new Set(ids.filter((x): x is string => !!x && x !== opts.actorId))];
}

/** Recipients for scheduled reminders. */
export function reminderRecipients(kind: "TASK_DUE" | "TASK_OVERDUE", people: TaskPeople) {
  const ids = [...people.assignees.map((a) => a.userId), ...(kind === "TASK_OVERDUE" ? [people.accountManagerId] : [])];
  return [...new Set(ids.filter((x): x is string => !!x))];
}

const DAY = 86_400_000;
const day = (d: Date | string) => {
  const x = new Date(d);
  return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
};

export type DigestTask = { id: string; status: string; dueDate: Date | string | null; deliveredAt: Date | string | null };
const DONE = new Set(["DELIVERED", "CLIENT_ACCEPTED"]);

/** Daily digest buckets: due today (open), overdue (open), delivered yesterday. */
export function digestBuckets<T extends DigestTask>(tasks: T[], today: Date) {
  const t0 = day(today);
  const dueToday: T[] = [];
  const overdue: T[] = [];
  const deliveredYesterday: T[] = [];
  for (const t of tasks) {
    const open = !DONE.has(t.status);
    if (open && t.dueDate && day(t.dueDate) === t0) dueToday.push(t);
    else if (open && t.dueDate && day(t.dueDate) < t0) overdue.push(t);
    if (t.deliveredAt && day(t.deliveredAt) === t0 - DAY) deliveredYesterday.push(t);
  }
  const byDue = (a: T, b: T) => day(a.dueDate!) - day(b.dueDate!);
  return { dueToday, overdue: overdue.sort(byDue), deliveredYesterday };
}
