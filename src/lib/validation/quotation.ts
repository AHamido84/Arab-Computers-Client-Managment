import { z } from "zod";
import { currencyCode, dateStr, num, optDateStr, optId, optStr, reqStr } from "./common";

export const QUOTATION_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const quotationItemSchema = z.object({
  id: z.string().optional(),
  requestId: optId,
  title: reqStr(200),
  scope: optStr(5000),
  startDate: optDateStr,
  dueDate: optDateStr,
  qty: num({ min: 0, max: 1e6 }),
  unitPrice: num({ min: 0, max: 1e10 }),
});

export const quotationSchema = z
  .object({
    clientId: reqStr(50),
    title: optStr(200),
    lang: z.enum(["ar", "en"]),
    issueDate: dateStr,
    validUntil: dateStr,
    currency: currencyCode,
    discount: num({ min: 0, max: 1e10 }),
    vatPercent: num({ min: 0, max: 100 }),
    introText: optStr(5000),
    terms: optStr(10000),
    items: z.array(quotationItemSchema).min(1, "quotations.needItems").max(200),
  })
  .refine((q) => q.validUntil >= q.issueDate, { path: ["validUntil"], message: "validation.dateOrder" });

export type QuotationInput = z.input<typeof quotationSchema>;

/**
 * Allowed status transitions. Edits are only allowed on DRAFT; to change a
 * sent quotation, create a new version.
 */
export const QUOTATION_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["ACCEPTED", "REJECTED", "DRAFT"],
  ACCEPTED: ["SENT"],
  REJECTED: ["SENT"],
};
export const canTransition = (from: QuotationStatus, to: QuotationStatus) => QUOTATION_TRANSITIONS[from].includes(to);
