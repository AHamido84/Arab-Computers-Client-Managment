import { describe, expect, it } from "vitest";
import { fillPlaceholders, unresolvedPlaceholders } from "@/lib/templates/render";
import { DEFAULT_EMAIL_TEMPLATES, DEFAULT_DOCUMENT_TEMPLATES, PLACEHOLDERS } from "@/lib/templates/defaults";

describe("fillPlaceholders", () => {
  it("replaces known placeholders, tolerating spaces and case", () => {
    expect(fillPlaceholders("Dear {{contact_name}}, due {{ Due_Date }}", { contact_name: "Ali", due_date: "1 Jan" })).toBe("Dear Ali, due 1 Jan");
  });
  it("keeps unknown or empty placeholders visible", () => {
    expect(fillPlaceholders("{{a}} {{b}} {{c}}", { a: "x", b: "" })).toBe("x {{b}} {{c}}");
  });
  it("works with Arabic text and numbers", () => {
    expect(fillPlaceholders("المبلغ: {{amc_amount}}", { amc_amount: 12000 })).toBe("المبلغ: 12000");
  });
  it("lists unresolved placeholders once", () => {
    expect(unresolvedPlaceholders("{{x}} {{y}} {{x}}")).toEqual(["x", "y"]);
  });
  it("default templates only use documented placeholders", () => {
    const known = new Set(Object.values(PLACEHOLDERS).flat());
    const texts = [
      ...Object.values(DEFAULT_EMAIL_TEMPLATES).flatMap((l) => Object.values(l).flatMap((t) => [t.subject, t.body])),
      ...Object.values(DEFAULT_DOCUMENT_TEMPLATES).flatMap((l) => Object.values(l).flatMap((t) => [t.title, t.body])),
    ];
    for (const txt of texts) for (const p of unresolvedPlaceholders(txt)) expect(known.has(p as never), p).toBe(true);
  });
});
