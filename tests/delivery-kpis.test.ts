import { describe, expect, it } from "vitest";
import { summarize, summarizeBy } from "@/lib/delivery-kpis";

const item = (o: Partial<Parameters<typeof summarize>[0][number]>) => ({ deliveredAt: null, originalDueDate: null, dueDate: null, estimated: 0, actual: 0, ...o });

describe("delivery KPIs", () => {
  it("measures on-time against the original due date", () => {
    const s = summarize([
      item({ deliveredAt: "2026-11-10", originalDueDate: "2026-11-10", dueDate: "2026-11-10", estimated: 10, actual: 8 }),
      // Due date moved to the 20th, but the original was the 5th → late.
      item({ deliveredAt: "2026-11-15", originalDueDate: "2026-11-05", dueDate: "2026-11-20", estimated: 5, actual: 9.5 }),
      // Delivered, no due date at all → counted as delivered, excluded from rate.
      item({ deliveredAt: "2026-11-15", estimated: 2, actual: 1 }),
      // Not delivered: hours count, no delivery.
      item({ dueDate: "2026-12-01", estimated: 4, actual: 1 }),
    ]);
    expect(s).toEqual({ delivered: 3, onTime: 1, late: 1, rate: 50, estimated: 21, actual: 19.5, variance: -1.5 });
  });

  it("returns a null rate when nothing measurable was delivered", () => {
    expect(summarize([item({ dueDate: "2026-12-01" })]).rate).toBeNull();
  });

  it("groups items, allowing one row in several groups", () => {
    const rows = [
      { people: ["a", "b"], i: item({ deliveredAt: "2026-11-01", originalDueDate: "2026-11-02", estimated: 4, actual: 4 }) },
      { people: ["a"], i: item({ deliveredAt: "2026-11-05", originalDueDate: "2026-11-02", estimated: 2, actual: 3 }) },
    ];
    const g = summarizeBy(rows, (r) => r.people.map((p) => ({ key: p, label: p.toUpperCase(), item: r.i })));
    expect(g.map((x) => [x.key, x.delivered, x.onTime, x.late, x.rate])).toEqual([
      ["a", 2, 1, 1, 50],
      ["b", 1, 1, 0, 100],
    ]);
  });
});
