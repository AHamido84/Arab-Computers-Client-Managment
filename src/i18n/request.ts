import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, LOCALE_COOKIE } from "./config";

/**
 * Locale resolution (no locale in the URL — this is an internal app):
 *   1. NEXT_LOCALE cookie (set at login from User.locale and by the header switcher)
 *   2. default (ar)
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(fromCookie) ? fromCookie : defaultLocale;
  return {
    locale,
    timeZone: "Africa/Cairo",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
