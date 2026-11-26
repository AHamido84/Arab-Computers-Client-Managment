import { z } from "zod";
import { currencyCode, num, optEmail, optStr, reqStr } from "./common";

const numberFormat = z
  .string()
  .trim()
  .min(3, "validation.minLength")
  .max(40, "validation.maxLength")
  .regex(/\{0+\}/, "settings.formatNeedsCounter");

export const companySettingsSchema = z.object({
  companyNameAr: reqStr(200),
  companyNameEn: reqStr(200),
  addressAr: optStr(300),
  addressEn: optStr(300),
  phone: optStr(50),
  email: optEmail,
  website: optStr(200),
  taxNumber: optStr(50),
  commercialRegister: optStr(50),
  letterheadFooterAr: optStr(300),
  letterheadFooterEn: optStr(300),
  defaultCurrency: currencyCode,
  vatPercent: num({ min: 0, max: 100 }),
  defaultAmcPercent: num({ min: 0, max: 100 }),
  defaultAmcYears: num({ min: 1, max: 30, int: true }),
  quotationValidityDays: num({ min: 1, max: 365, int: true }),
  arabicDigits: z.enum(["LATIN", "ARABIC_INDIC"]),
  contractNumberFormat: numberFormat,
  requestNumberFormat: numberFormat,
  quotationNumberFormat: numberFormat,
  clientCodeFormat: numberFormat,
});
export type CompanySettingsInput = z.input<typeof companySettingsSchema>;

export const notificationSettingsSchema = z.object({
  notifyIntervals: z
    .array(num({ min: 0, max: 365, int: true }))
    .min(1, "validation.required")
    .max(10)
    .transform((a) => [...new Set(a)].sort((x, y) => y - x)),
  notifyOverdueEveryDays: num({ min: 1, max: 90, int: true }),
  notifyByEmail: z.boolean(),
  taskReminderDays: z
    .array(num({ min: 0, max: 60, int: true }))
    .min(1, "validation.required")
    .max(10)
    .transform((a) => [...new Set(a)].sort((x, y) => y - x)),
  weeklyCapacityHours: num({ min: 1, max: 100, int: true }),
  deliveryDigest: z.boolean(),
  emailProvider: z.enum(["RESEND", "SMTP"]),
  emailFrom: optStr(200),
  emailReplyTo: optEmail,
});
export type NotificationSettingsInput = z.input<typeof notificationSettingsSchema>;

export const templateSchema = z.object({
  title: reqStr(300),
  body: reqStr(20000),
});
