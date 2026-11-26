import { z } from "zod";
import { reqStr } from "./common";

const emailList = z
  .array(z.string().trim().toLowerCase().pipe(z.email("validation.email")))
  .max(20)
  .transform((a) => [...new Set(a)]);

export const sendEmailSchema = z.object({
  kind: z.enum(["contract", "amc", "quotation"]),
  id: z.string().min(1),
  lang: z.enum(["ar", "en"]),
  to: emailList.refine((a) => a.length > 0, "email.needRecipient"),
  cc: emailList,
  subject: reqStr(300),
  body: reqStr(20000),
  attach: z.boolean(),
  markQuotationSent: z.boolean(),
});
export type SendEmailInput = z.input<typeof sendEmailSchema>;

/** Split "a@x.com, b@y.com; c@z.com" into a list. */
export const splitEmails = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
