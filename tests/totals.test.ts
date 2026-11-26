import { describe, expect, it } from "vitest";
import { computeTotals, lineTotal } from "@/lib/totals";

describe("totals", () => {
  it("computes subtotal, discount, VAT and total", () => {
    const t = computeTotals([{ qty: 1, unitPrice: 15000 }, { qty: 2, unitPrice: 4000 }], 3000, 14);
    expect(t).toMatchObject({ subtotal: 23000, discount: 3000, taxable: 20000, vat: 2800, total: 22800 });
  });
  it("accepts strings and Decimal-like values", () => {
    const dec = { toString: () => "1,250.50" };
    expect(lineTotal({ qty: "2", unitPrice: dec })).toBe(2501);
  });
  it("caps discount at subtotal and ignores negative discount", () => {
    expect(computeTotals([{ qty: 1, unitPrice: 100 }], 500, 14).total).toBe(0);
    expect(computeTotals([{ qty: 1, unitPrice: 100 }], -50, 0).total).toBe(100);
  });
  it("handles empty items", () => {
    expect(computeTotals([], 0, 14)).toMatchObject({ subtotal: 0, vat: 0, total: 0 });
  });
  it("rounds VAT to 2 decimals", () => {
    expect(computeTotals([{ qty: 3, unitPrice: 33.33 }], 0, 14).vat).toBe(14);
    expect(computeTotals([{ qty: 1, unitPrice: 10.05 }], 0, 14).vat).toBe(1.41);
  });
});
