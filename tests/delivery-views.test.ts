import { describe, expect, it } from "vitest";
import { computeWorkload, iso, loadLevel, monthGrid, startOfWeek, workingDaysBetween } from "@/lib/delivery-views";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
// 2026-11-26 is a Thursday; the week starts Saturday 2026-11-21.

describe("calendar helpers", () => {
  it("weeks start on Saturday", () => {
    expect(iso(startOfWeek(d("2026-11-26")))).toBe("2026-11-21");
    expect(iso(startOfWeek(d("2026-11-21")))).toBe("2026-11-21"); // Saturday itself
    expect(iso(startOfWeek(d("2026-11-27")))).toBe("2026-11-21"); // Friday
  });
  it("working days are Sun–Thu", () => {
    expect(workingDaysBetween(d("2026-11-26"), d("2026-12-01")).map(iso)).toEqual(["2026-11-26", "2026-11-29", "2026-11-30", "2026-12-01"]);
  });
  it("month grid is 42 days starting Saturday and contains the 1st", () => {
    const g = monthGrid(2026, 11); // December 2026
    expect(g).toHaveLength(42);
    expect(g[0].getUTCDay()).toBe(6);
    expect(g.map(iso)).toContain("2026-12-01");
  });
});

describe("workload", () => {
  const today = d("2026-11-26");
  const task = (o: Record<string, unknown>) => ({ id: "t", status: "IN_PROGRESS", startDate: null, dueDate: null, estimatedHours: null, loggedHours: 0, assignees: [{ userId: "u1" }], ...o });

  it("spreads remaining hours over working days up to the due date", () => {
    // Thu 26 Nov + Sun 29 / Mon 30 / Tue 1 Dec = 4 working days, 8h remaining → 2h/day
    const w = computeWorkload([task({ id: "a", dueDate: "2026-12-01", estimatedHours: 10, loggedHours: 2 })], today, 2);
    expect(w.weekStarts).toEqual(["2026-11-21", "2026-11-28"]);
    expect(w.byUser.get("u1")!.map((c) => c.hours)).toEqual([2, 6]);
  });
  it("splits a task's hours between assignees", () => {
    const w = computeWorkload([task({ id: "a", dueDate: "2026-11-26", estimatedHours: 8, assignees: [{ userId: "u1" }, { userId: "u2" }] })], today, 1);
    expect(w.byUser.get("u1")![0].hours).toBe(4);
    expect(w.byUser.get("u2")![0].hours).toBe(4);
  });
  it("puts overdue work in the current week", () => {
    const w = computeWorkload([task({ id: "late", dueDate: "2026-11-10", estimatedHours: 6 })], today, 2);
    expect(w.byUser.get("u1")!.map((c) => c.hours)).toEqual([6, 0]);
  });
  it("starts counting from a future start date", () => {
    const w = computeWorkload([task({ id: "f", startDate: "2026-11-29", dueDate: "2026-11-30", estimatedHours: 4 })], today, 2);
    expect(w.byUser.get("u1")!.map((c) => c.hours)).toEqual([0, 4]);
  });
  it("ignores done tasks; lists undated tasks as unscheduled", () => {
    const w = computeWorkload([task({ id: "done", status: "DELIVERED", dueDate: "2026-11-30", estimatedHours: 9 }), task({ id: "nodate", estimatedHours: 5 })], today, 1);
    expect(w.byUser.get("u1")).toBeUndefined();
    expect(w.unscheduled.get("u1")).toEqual(["nodate"]);
  });
  it("only counts hours inside the horizon", () => {
    const w = computeWorkload([task({ id: "long", dueDate: "2027-01-28", estimatedHours: 45 })], today, 1);
    const hours = w.byUser.get("u1")![0].hours;
    expect(hours).toBeGreaterThan(0);
    expect(hours).toBeLessThan(45);
  });
  it("load levels", () => {
    expect(loadLevel(0, 40)).toBe("none");
    expect(loadLevel(20, 40)).toBe("ok");
    expect(loadLevel(32, 40)).toBe("high");
    expect(loadLevel(41, 40)).toBe("over");
  });
});
