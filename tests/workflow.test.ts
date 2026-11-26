import { describe, expect, it } from "vitest";
import { canTransition } from "@/lib/validation/quotation";
import { isRequestOverdue } from "@/lib/validation/request";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("quotation transitions", () => {
  it("draft can only be sent", () => {
    expect(canTransition("DRAFT", "SENT")).toBe(true);
    expect(canTransition("DRAFT", "ACCEPTED")).toBe(false);
  });
  it("sent can be accepted, rejected or reverted to draft", () => {
    expect(canTransition("SENT", "ACCEPTED")).toBe(true);
    expect(canTransition("SENT", "REJECTED")).toBe(true);
    expect(canTransition("SENT", "DRAFT")).toBe(true);
  });
  it("decisions can be undone back to sent only", () => {
    expect(canTransition("ACCEPTED", "SENT")).toBe(true);
    expect(canTransition("ACCEPTED", "REJECTED")).toBe(false);
  });
});

describe("request overdue", () => {
  const today = d("2026-05-10");
  it("open + past due is overdue", () => {
    expect(isRequestOverdue({ status: "IN_PROGRESS", dueDate: d("2026-05-09") }, today)).toBe(true);
  });
  it("due today is not overdue", () => {
    expect(isRequestOverdue({ status: "NEW", dueDate: d("2026-05-10") }, today)).toBe(false);
  });
  it("closed/delivered/rejected are never overdue", () => {
    for (const s of ["CLOSED", "DELIVERED", "REJECTED"]) expect(isRequestOverdue({ status: s, dueDate: d("2020-01-01") }, today)).toBe(false);
  });
  it("no due date is never overdue", () => {
    expect(isRequestOverdue({ status: "NEW", dueDate: null }, today)).toBe(false);
  });
});
