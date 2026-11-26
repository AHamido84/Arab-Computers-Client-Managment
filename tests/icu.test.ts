import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import en from "../messages/en.json";
import ar from "../messages/ar.json";

/** Every message must be valid ICU and format without throwing (catches stray braces). */
function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]));
}

describe("ICU messages", () => {
  for (const [locale, messages] of Object.entries({ en, ar })) {
    it(`${locale}: all messages format`, () => {
      const errors: string[] = [];
      const t = createTranslator({ locale, messages, onError: (e) => errors.push(e.message) });
      const args = { count: 2, name: "X", page: 1, pages: 2, min: 1, max: 2, date: "d", year: 1, email: "e", vars: "V", value: "v", example: "{{x}}", rate: 14, version: 2, list: "a, b", created: 3, overdue: 1, intervals: "30, 14", every: 7, currency: "EGP" };
      for (const k of keys(messages)) t(k as never, args as never);
      expect(errors.join("\n")).toBe("");
    });
  }
  it("numbering hint keeps literal tokens", () => {
    const t = createTranslator({ locale: "en", messages: en });
    expect(t("settings.numberingHint")).toContain("{YYYY}");
    expect(t("settings.formatNeedsCounter")).toContain("{0000}");
  });
});

describe("literal brackets", () => {
  it("email hint renders the literal address", () => {
    const t = createTranslator({ locale: "en", messages: en });
    expect(t("settings.emailFromHint")).toContain("Arab Computers <billing@arab-computers.com>");
  });
});
