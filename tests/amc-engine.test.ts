import { describe, expect, it } from "vitest";
import {
  addYearsUTC,
  baseAmc,
  defaultAmcStartDate,
  deriveAmcStatus,
  generateAmcSchedule,
  totalAmc,
} from "@/lib/amc/engine";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const amounts = (l: { amount: number }[]) => l.map((x) => x.amount);

const base = {
  contractValue: 200_000,
  amcPercent: 10,
  increasePercent: 10,
  startDate: d("2025-03-15"),
  years: 4,
};

describe("dates", () => {
  it("defaults AMC start to one year after contract date", () => {
    expect(defaultAmcStartDate(d("2024-06-01")).toISOString().slice(0, 10)).toBe("2025-06-01");
  });
  it("clamps Feb 29 in non-leap years", () => {
    expect(addYearsUTC(d("2024-02-29"), 1).toISOString().slice(0, 10)).toBe("2025-02-28");
    expect(addYearsUTC(d("2024-02-29"), 4).toISOString().slice(0, 10)).toBe("2028-02-29");
  });
  it("spaces due dates one year apart", () => {
    const lines = generateAmcSchedule({ ...base, method: "COMPOUND" });
    expect(lines.map((l) => l.dueDate.toISOString().slice(0, 10))).toEqual([
      "2025-03-15",
      "2026-03-15",
      "2027-03-15",
      "2028-03-15",
    ]);
  });
});

describe("compound method", () => {
  it("increases on previous year", () => {
    const lines = generateAmcSchedule({ ...base, method: "COMPOUND" });
    expect(baseAmc(200_000, 10)).toBe(20_000);
    expect(amounts(lines)).toEqual([20_000, 22_000, 24_200, 26_620]);
    expect(lines[0].increasePercent).toBe(0);
    expect(totalAmc(lines)).toBe(92_820);
  });

  it("per-year increase override recalculates following years", () => {
    const lines = generateAmcSchedule({
      ...base,
      method: "COMPOUND",
      overrides: { 2: { increasePercent: 20 } },
    });
    // y2 = 20000*1.2 = 24000; y3 = 24000*1.1 = 26400; y4 = 29040
    expect(amounts(lines)).toEqual([20_000, 24_000, 26_400, 29_040]);
  });

  it("amount override carries forward into later years", () => {
    const lines = generateAmcSchedule({
      ...base,
      method: "COMPOUND",
      overrides: { 2: { amount: 21_000 } },
    });
    expect(amounts(lines)).toEqual([20_000, 21_000, 23_100, 25_410]);
    expect(lines[1].source).toBe("override");
    expect(lines[1].computedAmount).toBe(22_000);
  });

  it("year 1 increase override applies to base", () => {
    const lines = generateAmcSchedule({
      ...base,
      method: "COMPOUND",
      years: 2,
      overrides: { 1: { increasePercent: 5 } },
    });
    expect(amounts(lines)).toEqual([21_000, 23_100]);
  });

  it("locked (paid) years keep their amount and drive later years", () => {
    const lines = generateAmcSchedule({
      ...base,
      method: "COMPOUND",
      increasePercent: 15, // contract % changed after year 2 was paid
      locked: { 1: 20_000, 2: 22_000 },
    });
    expect(amounts(lines)).toEqual([20_000, 22_000, 25_300, 29_095]);
    expect(lines[1].source).toBe("locked");
  });

  it("lock wins over an amount override", () => {
    const lines = generateAmcSchedule({
      ...base,
      method: "COMPOUND",
      years: 2,
      overrides: { 2: { amount: 1 } },
      locked: { 2: 22_000 },
    });
    expect(lines[1].amount).toBe(22_000);
  });
});

describe("simple method", () => {
  it("increases on base AMC", () => {
    const lines = generateAmcSchedule({ ...base, method: "SIMPLE" });
    expect(amounts(lines)).toEqual([20_000, 22_000, 24_000, 26_000]);
  });

  it("per-year increase override changes cumulative % for following years", () => {
    const lines = generateAmcSchedule({
      ...base,
      method: "SIMPLE",
      overrides: { 2: { increasePercent: 5 } },
    });
    // cumulative: y2 5%, y3 15%, y4 25%
    expect(amounts(lines)).toEqual([20_000, 21_000, 23_000, 25_000]);
  });

  it("amount override affects only that year", () => {
    const lines = generateAmcSchedule({
      ...base,
      method: "SIMPLE",
      overrides: { 3: { amount: 30_000 } },
    });
    expect(amounts(lines)).toEqual([20_000, 22_000, 30_000, 26_000]);
  });

  it("zero increase gives flat schedule", () => {
    const lines = generateAmcSchedule({ ...base, method: "SIMPLE", increasePercent: 0 });
    expect(amounts(lines)).toEqual([20_000, 20_000, 20_000, 20_000]);
  });
});

describe("edge cases", () => {
  it("rounds to 2 decimals each year", () => {
    const lines = generateAmcSchedule({
      ...base,
      contractValue: 123_456.78,
      amcPercent: 12.5,
      increasePercent: 7.25,
      method: "COMPOUND",
      years: 3,
    });
    expect(amounts(lines)).toEqual([15_432.1, 16_550.93, 17_750.87]);
  });
  it("returns empty for 0 years", () => {
    expect(generateAmcSchedule({ ...base, method: "COMPOUND", years: 0 })).toEqual([]);
  });
});

describe("status", () => {
  const today = d("2026-05-01");
  it("paid wins", () => {
    expect(deriveAmcStatus({ dueDate: d("2026-01-01"), paidAt: d("2026-01-05") }, today)).toBe("PAID");
  });
  it("past due is overdue", () => {
    expect(deriveAmcStatus({ dueDate: d("2026-04-30") }, today)).toBe("OVERDUE");
  });
  it("due today is still pending", () => {
    expect(deriveAmcStatus({ dueDate: d("2026-05-01") }, today)).toBe("PENDING");
  });
});
