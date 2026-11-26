/**
 * Shared zod building blocks. Messages are i18n keys resolved on the client
 * (see `useFieldError`), so validation errors appear in Arabic or English.
 * Form inputs submit strings; these helpers coerce/normalise them.
 */
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === null || (typeof v === "string" && v.trim() === "") ? undefined : v);

export const reqStr = (max = 200) =>
  z.string({ error: "validation.required" }).trim().min(1, "validation.required").max(max, "validation.maxLength");

/** Optional text: "" → null. */
export const optStr = (max = 2000) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max, "validation.maxLength").optional()).transform((v) => v ?? null);

export const optEmail = z
  .preprocess(emptyToUndefined, z.string().trim().toLowerCase().pipe(z.email("validation.email")).optional())
  .transform((v) => v ?? null);

export const optPhone = z
  .preprocess(emptyToUndefined, z.string().trim().regex(/^\+?[0-9\s\-()]{6,20}$/, "validation.phone").optional())
  .transform((v) => v ?? null);

export const optId = z.preprocess(emptyToUndefined, z.string().optional()).transform((v) => v ?? null);

/** YYYY-MM-DD from <input type="date"> → Date at UTC midnight. */
export const dateStr = z
  .string({ error: "validation.required" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "validation.date")
  .transform((s) => new Date(`${s}T00:00:00Z`))
  .refine((d) => !Number.isNaN(d.getTime()), "validation.date");

export const optDateStr = z.preprocess(emptyToUndefined, dateStr.optional()).transform((v) => v ?? null);

/** Number from a text/number input. */
export const num = (opts: { min?: number; max?: number; int?: boolean } = {}) => {
  let n = z.number({ error: "validation.number" });
  if (opts.int) n = n.int("validation.integer");
  if (opts.min !== undefined) n = n.min(opts.min, opts.min === 0 ? "validation.nonNegative" : "validation.min");
  if (opts.max !== undefined) n = n.max(opts.max, "validation.max");
  return z.preprocess((v) => {
    const e = emptyToUndefined(v);
    if (e === undefined) return undefined;
    return typeof e === "string" ? Number(e.replace(/,/g, "")) : e;
  }, n);
};

export const optNum = (opts: Parameters<typeof num>[0] = {}) =>
  z.preprocess(emptyToUndefined, num(opts).optional()).transform((v) => v ?? null);

export const currencyCode = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "validation.invalid");

/** Turn a Date (UTC midnight) back into YYYY-MM-DD for <input type="date">. */
export const toDateInput = (d: Date | string | null | undefined) =>
  d ? (typeof d === "string" ? d : d.toISOString()).slice(0, 10) : "";
