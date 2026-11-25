import { z } from "zod";
import { optStr, reqStr } from "./common";

export const lookupKinds = ["CLIENT_STATUS", "INDUSTRY", "PRODUCT", "REQUEST_TYPE", "PAYMENT_TERM"] as const;

export const lookupSchema = z.object({
  kind: z.enum(lookupKinds),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{2,40}$/, "validation.lookupKey"),
  labelAr: reqStr(120),
  labelEn: reqStr(120),
  color: optStr(20),
  active: z.boolean(),
});
export type LookupInput = z.input<typeof lookupSchema>;
