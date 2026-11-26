/**
 * Locale-aware formatting helpers (dates, numbers, money).
 * Arabic uses Latin digits by default ("ar-EG-u-nu-latn"); switch to
 * Arabic-Indic digits via Settings → arabicDigits.
 */
import type { AppLocale } from "@/i18n/config";

export type DigitStyle = "LATIN" | "ARABIC_INDIC";

export function intlLocale(locale: AppLocale, digits: DigitStyle = "LATIN") {
  if (locale === "en") return "en-GB";
  return digits === "LATIN" ? "ar-EG-u-nu-latn" : "ar-EG";
}

type Num = number | string | { toString(): string } | null | undefined;
const toNum = (v: Num) => (v == null ? 0 : typeof v === "number" ? v : Number(v.toString()));

export function formatNumber(v: Num, locale: AppLocale, digits?: DigitStyle, fractionDigits = 0) {
  return new Intl.NumberFormat(intlLocale(locale, digits), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: Math.max(fractionDigits, 2),
  }).format(toNum(v));
}

export function formatMoney(v: Num, currency: string, locale: AppLocale, digits?: DigitStyle) {
  try {
    return new Intl.NumberFormat(intlLocale(locale, digits), {
      style: "currency",
      currency,
      currencyDisplay: locale === "ar" ? "symbol" : "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(toNum(v));
  } catch {
    return `${formatNumber(v, locale, digits, 2)} ${currency}`;
  }
}

/** Compact money for KPI cards, e.g. "EGP 1.2M". */
export function formatMoneyCompact(v: Num, currency: string, locale: AppLocale, digits?: DigitStyle) {
  const n = new Intl.NumberFormat(intlLocale(locale, digits), {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(toNum(v));
  return locale === "ar" ? `${n} ${currencyLabel(currency, locale)}` : `${currency} ${n}`;
}

export function currencyLabel(currency: string, locale: AppLocale) {
  if (locale === "ar") return ({ EGP: "ج.م", USD: "دولار", EUR: "يورو", SAR: "ر.س", AED: "د.إ" } as Record<string, string>)[currency] ?? currency;
  return currency;
}

/** Dates are stored as UTC midnight (@db.Date) — always format in UTC. */
export function formatDate(d: Date | string | null | undefined, locale: AppLocale, digits?: DigitStyle) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(intlLocale(locale, digits), {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(d: Date | string | null | undefined, locale: AppLocale, digits?: DigitStyle) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(intlLocale(locale, digits), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Cairo",
  }).format(date);
}

/** Today's date at UTC midnight in Cairo time — the business "today". */
export function todayUTC(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(now); // YYYY-MM-DD
  return new Date(`${parts}T00:00:00Z`);
}

export function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** Full currency name for document text (e.g. "الجنيه المصري" / "Egyptian Pounds (EGP)"). */
export function currencyName(currency: string, locale: AppLocale) {
  const ar: Record<string, string> = { EGP: "الجنيه المصري", USD: "الدولار الأمريكي", EUR: "اليورو", SAR: "الريال السعودي", AED: "الدرهم الإماراتي", KWD: "الدينار الكويتي", QAR: "الريال القطري" };
  const en: Record<string, string> = { EGP: "Egyptian Pounds (EGP)", USD: "US Dollars (USD)", EUR: "Euros (EUR)", SAR: "Saudi Riyals (SAR)", AED: "UAE Dirhams (AED)", KWD: "Kuwaiti Dinars (KWD)", QAR: "Qatari Riyals (QAR)" };
  return (locale === "ar" ? ar : en)[currency] ?? currency;
}
