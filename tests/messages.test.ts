import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import ar from "../messages/ar.json";

function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("translations", () => {
  it("Arabic and English define exactly the same keys", () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });
  it("no empty strings", () => {
    for (const [name, m] of Object.entries({ en, ar })) {
      for (const k of keys(m)) {
        const v = k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], m);
        expect(v, `${name}:${k}`).not.toBe("");
      }
    }
  });
  it("keys contain no dots (next-intl namespace separator)", () => {
    const walk = (o: Record<string, unknown>) =>
      Object.entries(o).forEach(([k, v]) => {
        expect(k.includes(".")).toBe(false);
        if (v && typeof v === "object") walk(v as Record<string, unknown>);
      });
    walk(en);
  });
});
