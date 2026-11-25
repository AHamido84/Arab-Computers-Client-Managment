/** Supported UI / document languages. Arabic is the default. */
export const locales = ["ar", "en"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "ar";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export const isLocale = (v: unknown): v is AppLocale =>
  typeof v === "string" && (locales as readonly string[]).includes(v);

export const dirOf = (l: AppLocale) => (l === "ar" ? "rtl" : "ltr");
