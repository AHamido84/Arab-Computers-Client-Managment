/**
 * Delivery KPIs (pure, unit-tested). "On time" compares the delivery date with
 * the task's ORIGINAL due date, so moving a due date never turns a late task
 * into an on-time one. Tasks without any due date count as delivered but are
 * left out of the on-time rate.
 */
import { deliveredOnTime } from "./delivery";

export type KpiItem = {
  deliveredAt: Date | string | null;
  originalDueDate: Date | string | null;
  dueDate: Date | string | null;
  estimated: number;
  actual: number;
};

export type KpiSummary = { delivered: number; onTime: number; late: number; rate: number | null; estimated: number; actual: number; variance: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

export function summarize(items: KpiItem[]): KpiSummary {
  let onTime = 0;
  let late = 0;
  let delivered = 0;
  let estimated = 0;
  let actual = 0;
  for (const i of items) {
    estimated += i.estimated;
    actual += i.actual;
    if (!i.deliveredAt) continue;
    delivered++;
    const ok = deliveredOnTime(i);
    if (ok === true) onTime++;
    else if (ok === false) late++;
  }
  return { delivered, onTime, late, rate: onTime + late ? Math.round((onTime / (onTime + late)) * 100) : null, estimated: r2(estimated), actual: r2(actual), variance: r2(actual - estimated) };
}

/** Group items (an item may belong to several groups, e.g. several assignees) and summarize each. */
export function summarizeBy<T>(rows: T[], groups: (row: T) => { key: string; label: string; item: KpiItem }[]) {
  const map = new Map<string, { label: string; items: KpiItem[] }>();
  for (const row of rows)
    for (const g of groups(row)) {
      const e = map.get(g.key) ?? { label: g.label, items: [] };
      e.items.push(g.item);
      map.set(g.key, e);
    }
  return [...map.entries()]
    .map(([key, e]) => ({ key, label: e.label, ...summarize(e.items) }))
    .sort((a, b) => b.delivered - a.delivered || a.label.localeCompare(b.label));
}
