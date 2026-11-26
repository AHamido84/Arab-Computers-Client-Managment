import { describe, expect, it } from "vitest";
import { deliveredOnTime, isTaskOverdue, latestDueDate, mergeDrafts, projectProgress, splitDraft, type DraftTask } from "@/lib/delivery";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const draft = (o: Partial<DraftTask> = {}): DraftTask => ({
  key: "k", title: "Integration", scope: "Build it", price: 1000, estimatedHours: 10, startDate: "2026-12-01", dueDate: "2026-12-10",
  requestId: "r1", quotationItemId: "q1", assignees: [], watchers: [], ...o,
});

describe("projectProgress", () => {
  it("weights by estimated hours and counts delivered as 100%", () => {
    expect(projectProgress([
      { status: "IN_PROGRESS", progress: 50, estimatedHours: 30 },
      { status: "DELIVERED", progress: 20, estimatedHours: 10 },
    ])).toBe(63); // (50*30 + 100*10) / 40 = 62.5
  });
  it("uses equal weights when no hours", () => {
    expect(projectProgress([{ status: "NOT_STARTED", progress: 0 }, { status: "CLIENT_ACCEPTED", progress: 0 }])).toBe(50);
  });
  it("clamps progress and handles empty", () => {
    expect(projectProgress([{ status: "IN_PROGRESS", progress: 150 }])).toBe(100);
    expect(projectProgress([])).toBe(0);
  });
});

describe("overdue & on-time", () => {
  const today = d("2026-12-10");
  it("open task past due is overdue; due today is not", () => {
    expect(isTaskOverdue({ status: "IN_PROGRESS", dueDate: d("2026-12-09") }, today)).toBe(true);
    expect(isTaskOverdue({ status: "IN_PROGRESS", dueDate: d("2026-12-10") }, today)).toBe(false);
  });
  it("delivered tasks are never overdue", () => {
    expect(isTaskOverdue({ status: "DELIVERED", dueDate: d("2026-01-01") }, today)).toBe(false);
  });
  it("on-time is measured against the original due date", () => {
    // due date was moved later, but delivery missed the original commitment
    expect(deliveredOnTime({ deliveredAt: d("2026-12-12"), originalDueDate: d("2026-12-10"), dueDate: d("2026-12-15") })).toBe(false);
    expect(deliveredOnTime({ deliveredAt: new Date("2026-12-10T22:00:00Z"), originalDueDate: d("2026-12-10"), dueDate: null })).toBe(true);
    expect(deliveredOnTime({ deliveredAt: null, originalDueDate: d("2026-12-10"), dueDate: null })).toBeNull();
  });
  it("latest due date", () => {
    expect(latestDueDate([{ dueDate: "2026-12-01" }, { dueDate: null }, { dueDate: "2027-01-05" }])).toBe("2027-01-05");
    expect(latestDueDate([])).toBeNull();
  });
});

describe("split / merge", () => {
  it("splits price and hours; remainder on the last part", () => {
    const parts = splitDraft(draft({ price: 1000, estimatedHours: 10 }), 3);
    expect(parts.map((p) => p.price)).toEqual([333.33, 333.33, 333.34]);
    expect(parts.map((p) => p.estimatedHours)).toEqual([3.33, 3.33, 3.34]);
    expect(parts[0].title).toBe("Integration (1/3)");
    expect(new Set(parts.map((p) => p.key)).size).toBe(3);
  });
  it("keeps null price/hours as null", () => {
    expect(splitDraft(draft({ price: null, estimatedHours: null }))[0].price).toBeNull();
  });
  it("merges: sums, date span, single lead, watchers not duplicated as assignees", () => {
    const m = mergeDrafts([
      draft({ title: "A", price: 100, estimatedHours: 2, startDate: "2026-12-05", dueDate: "2026-12-08", assignees: [{ userId: "u1", role: "LEAD" }], watchers: ["u2"] }),
      draft({ title: "B", price: 50, estimatedHours: null, startDate: "2026-12-01", dueDate: "2026-12-20", assignees: [{ userId: "u2", role: "LEAD" }, { userId: "u1", role: "MEMBER" }], watchers: ["u3"] }),
    ]);
    expect(m.title).toBe("A + B");
    expect(m.price).toBe(150);
    expect(m.estimatedHours).toBe(2);
    expect([m.startDate, m.dueDate]).toEqual(["2026-12-01", "2026-12-20"]);
    expect(m.assignees.filter((a) => a.role === "LEAD")).toHaveLength(1);
    expect(m.assignees.map((a) => a.userId).sort()).toEqual(["u1", "u2"]);
    expect(m.watchers).toEqual(["u3"]);
    expect(m.requestId).toBe("r1");
    expect(m.scope).toBe("Build it"); // identical scopes are not repeated
  });
  it("refuses to merge a single task", () => {
    expect(() => mergeDrafts([draft()])).toThrow();
  });
});
