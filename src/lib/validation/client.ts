import { z } from "zod";
import { optEmail, optId, optPhone, optStr, reqStr } from "./common";

export const contactSchema = z.object({
  id: z.string().optional(),
  name: reqStr(120),
  jobTitle: optStr(120),
  phone: optPhone,
  whatsapp: optPhone,
  email: optEmail,
  isPrimary: z.boolean().default(false),
});

export const clientSchema = z.object({
  nameAr: reqStr(200),
  nameEn: reqStr(200),
  statusId: reqStr(50),
  industryId: optId,
  preferredLang: z.enum(["ar", "en"]),
  address: optStr(300),
  city: optStr(100),
  website: optStr(200),
  taxNumber: optStr(50),
  notes: optStr(5000),
  accountManagerId: optId,
  contacts: z.array(contactSchema).max(50),
});

export type ClientInput = z.input<typeof clientSchema>;
export type ClientData = z.output<typeof clientSchema>;
