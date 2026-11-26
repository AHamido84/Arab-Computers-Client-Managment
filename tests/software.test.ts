import { describe, expect, it } from "vitest";
import { softwareKey, softwareSchema } from "@/lib/validation/software";

describe("software", () => {
  it("builds a stable key from the English name", () => {
    expect(softwareKey("HR & Payroll System")).toBe("HR_PAYROLL_SYSTEM");
    expect(softwareKey("  odoo 17 — CRM ")).toBe("ODOO_17_CRM");
    expect(softwareKey("X")).toBe("SW_X");
    expect(softwareKey("A".repeat(60))).toHaveLength(36);
  });
  it("requires both names and trims the description", () => {
    expect(softwareSchema.safeParse({ nameAr: "", nameEn: "ERP", active: true }).success).toBe(false);
    expect(softwareSchema.parse({ nameAr: "نظام", nameEn: "ERP", description: "  ", active: true }).description).toBeNull();
  });
});
