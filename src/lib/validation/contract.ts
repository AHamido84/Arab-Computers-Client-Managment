import { z } from "zod";
import { currencyCode, dateStr, num, optDateStr, optNum, optStr, reqStr } from "./common";

export const contractSchema = z
  .object({
    clientId: reqStr(50),
    title: optStr(200),
    productIds: z.array(z.string()).min(1, "validation.required"),
    contractDate: dateStr,
    startDate: dateStr,
    endDate: optDateStr,
    value: num({ min: 0, max: 1e12 }),
    currency: currencyCode,
    paymentTerms: optStr(500),
    status: z.enum(["DRAFT", "ACTIVE", "EXPIRED", "CANCELLED"]),
    notes: optStr(5000),
    amcEnabled: z.boolean(),
    amcPercent: num({ min: 0, max: 100 }),
    amcIncreasePercent: num({ min: 0, max: 100 }),
    amcMethod: z.enum(["COMPOUND", "SIMPLE"]),
    amcStartDate: optDateStr,
    amcYears: num({ min: 1, max: 30, int: true }),
  })
  .refine((c) => !c.endDate || c.endDate >= c.startDate, { path: ["endDate"], message: "validation.dateOrder" });

export type ContractInput = z.input<typeof contractSchema>;
export type ContractData = z.output<typeof contractSchema>;

/** Edit a single AMC year: overrides apply to this year, later years recalculate. */
export const amcLineOverrideSchema = z.object({
  increasePercentOverride: optNum({ min: -100, max: 1000 }),
  amountOverride: optNum({ min: 0, max: 1e12 }),
  notes: optStr(1000),
});

export const amcPaymentSchema = z.object({
  paidAt: dateStr,
  paidAmount: num({ min: 0, max: 1e12 }),
  invoiceRef: optStr(100),
});

export type AmcLineOverrideInput = z.input<typeof amcLineOverrideSchema>;
export type AmcPaymentInput = z.input<typeof amcPaymentSchema>;
