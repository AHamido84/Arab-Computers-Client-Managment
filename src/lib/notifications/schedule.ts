/**
 * Notification scheduling rules (pure, unit-tested).
 *
 * Upcoming — intervals are "days before due date", e.g. [30, 14, 3].
 *   An item fires once per window: the window is the SMALLEST interval that is
 *   ≥ days remaining. With [30,14,3]: 30…15 days → "30", 14…4 → "14",
 *   3…0 → "3". Use 0 for "on the due date". If the daily job misses a day,
 *   the alert still fires on the next run because windows are ranges.
 *
 * Overdue — fires on the first overdue day, then repeats every
 *   `overdueEveryDays` (bucket = floor((daysOverdue − 1) / every)).
 *
 * The trigger key includes the due date so rescheduling an item re-arms its
 * alerts, and (userId, triggerKey) is unique in the DB so re-running the job
 * never duplicates notifications.
 */

export type ScheduledKind = "AMC_UPCOMING" | "AMC_OVERDUE" | "REQUEST_DUE" | "REQUEST_OVERDUE" | "TASK_DUE" | "TASK_OVERDUE";
export type ScheduledType = "amc" | "request" | "task";

const KINDS: Record<ScheduledType, [ScheduledKind, ScheduledKind]> = {
  amc: ["AMC_UPCOMING", "AMC_OVERDUE"],
  request: ["REQUEST_DUE", "REQUEST_OVERDUE"],
  task: ["TASK_DUE", "TASK_OVERDUE"],
};

export type Trigger = {
  kind: ScheduledKind;
  /** Days before due date (negative = days overdue). */
  daysBefore: number;
  triggerKey: string;
};

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function daysUntil(due: Date, today: Date) {
  const a = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const b = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((a - b) / DAY);
}

export function computeTrigger(
  item: { type: ScheduledType; id: string; dueDate: Date },
  today: Date,
  opts: { intervals: number[]; overdueEveryDays: number },
): Trigger | null {
  const days = daysUntil(item.dueDate, today);
  const base = `${item.type}:${item.id}:${isoDay(item.dueDate)}`;
  if (days >= 0) {
    const windows = [...new Set(opts.intervals.filter((n) => Number.isInteger(n) && n >= 0))].sort((a, b) => a - b);
    const window = windows.find((w) => w >= days);
    if (window === undefined) return null;
    return {
      kind: KINDS[item.type][0],
      daysBefore: days,
      triggerKey: `${base}:before:${window}`,
    };
  }
  const overdue = -days;
  const every = Math.max(1, Math.trunc(opts.overdueEveryDays) || 1);
  const bucket = Math.floor((overdue - 1) / every);
  return {
    kind: KINDS[item.type][1],
    daysBefore: days,
    triggerKey: `${base}:overdue:${bucket}`,
  };
}

/** Recipients: the responsible person (account manager / assignee) plus all admins, de-duplicated. */
export function recipientsFor(responsible: (string | null | undefined)[], adminIds: string[]) {
  return [...new Set([...responsible.filter((x): x is string => !!x), ...adminIds])];
}
