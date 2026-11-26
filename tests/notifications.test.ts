import { describe, expect, it } from "vitest";
import { computeTrigger, daysUntil, recipientsFor } from "@/lib/notifications/schedule";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const opts = { intervals: [30, 14, 3], overdueEveryDays: 7 };
const due = d("2026-06-30");
const at = (today: string, o = opts) => computeTrigger({ type: "amc", id: "L1", dueDate: due }, d(today), o);

describe("daysUntil", () => {
  it("counts whole days and ignores time of day", () => {
    expect(daysUntil(due, d("2026-06-01"))).toBe(29);
    expect(daysUntil(due, new Date("2026-06-29T23:59:00Z"))).toBe(1);
    expect(daysUntil(due, d("2026-07-02"))).toBe(-2);
  });
});

describe("upcoming windows", () => {
  it("nothing before the largest interval", () => {
    expect(at("2026-05-30")).toBeNull(); // 31 days
  });
  it("30-day window covers 30..15 days and shares one key", () => {
    const a = at("2026-05-31")!; // 30
    const b = at("2026-06-15")!; // 15
    expect(a.kind).toBe("AMC_UPCOMING");
    expect(a.triggerKey).toBe(b.triggerKey);
    expect(a.triggerKey).toContain(":before:30");
  });
  it("switches to the 14-day and 3-day windows", () => {
    expect(at("2026-06-16")!.triggerKey).toContain(":before:14"); // 14
    expect(at("2026-06-26")!.triggerKey).toContain(":before:14"); // 4
    expect(at("2026-06-27")!.triggerKey).toContain(":before:3"); // 3
    expect(at("2026-06-30")!.triggerKey).toContain(":before:3"); // due day
  });
  it("supports a due-day interval 0", () => {
    const o = { intervals: [7, 0], overdueEveryDays: 7 };
    expect(at("2026-06-29", o)!.triggerKey).toContain(":before:7");
    expect(at("2026-06-30", o)!.triggerKey).toContain(":before:0");
  });
  it("still fires if the job missed days (window is a range)", () => {
    expect(at("2026-06-20")!.triggerKey).toContain(":before:14");
  });
  it("ignores invalid and duplicate intervals", () => {
    expect(at("2026-06-20", { intervals: [14, 14, -1, 2.5], overdueEveryDays: 7 })!.triggerKey).toContain(":before:14");
  });
});

describe("overdue", () => {
  it("fires on day 1 and repeats every N days", () => {
    const k1 = at("2026-07-01")!; // 1 day overdue
    const k7 = at("2026-07-07")!; // 7
    const k8 = at("2026-07-08")!; // 8
    expect(k1.kind).toBe("AMC_OVERDUE");
    expect(k1.daysBefore).toBe(-1);
    expect(k1.triggerKey).toBe(k7.triggerKey);
    expect(k8.triggerKey).not.toBe(k7.triggerKey);
  });
  it("treats overdueEveryDays < 1 as daily", () => {
    const o = { intervals: [3], overdueEveryDays: 0 };
    expect(at("2026-07-01", o)!.triggerKey).not.toBe(at("2026-07-02", o)!.triggerKey);
  });
});

describe("keys", () => {
  it("rescheduling the due date re-arms alerts", () => {
    const a = computeTrigger({ type: "request", id: "R1", dueDate: d("2026-06-30") }, d("2026-06-28"), opts)!;
    const b = computeTrigger({ type: "request", id: "R1", dueDate: d("2026-07-01") }, d("2026-06-28"), opts)!;
    expect(a.kind).toBe("REQUEST_DUE");
    expect(a.triggerKey).not.toBe(b.triggerKey);
  });
  it("request overdue kind", () => {
    expect(computeTrigger({ type: "request", id: "R1", dueDate: d("2026-06-01") }, d("2026-06-05"), opts)!.kind).toBe("REQUEST_OVERDUE");
  });
});

describe("recipients", () => {
  it("responsible person + admins, no duplicates or nulls", () => {
    expect(recipientsFor(["u1", null, "a1"], ["a1", "a2"])).toEqual(["u1", "a1", "a2"]);
  });
});
