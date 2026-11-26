import { z } from "zod";
import { optStr, reqStr } from "./common";

/** Software / system the company implements and maintains (stored as a PRODUCT lookup). */
export const softwareSchema = z.object({
  nameAr: reqStr(120),
  nameEn: reqStr(120),
  description: optStr(2000),
  active: z.boolean(),
});
export type SoftwareInput = z.input<typeof softwareSchema>;

/** Stable machine key from the English name, e.g. "HR & Payroll" → "HR_PAYROLL". */
export function softwareKey(nameEn: string) {
  const k = nameEn
    .normalize("NFKD")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 36);
  return k.length >= 2 ? k : `SW_${k || "X"}`;
}
