"use client";

import { createContext, useContext, useMemo } from "react";
import { useLocale } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  type DigitStyle,
} from "@/lib/format";

const Ctx = createContext<{ digits: DigitStyle; currency: string }>({ digits: "LATIN", currency: "EGP" });

/** Provides company-wide formatting settings (digit style, default currency) to client components. */
export function FormatProvider({ digits, currency, children }: { digits: DigitStyle; currency: string; children: React.ReactNode }) {
  const value = useMemo(() => ({ digits, currency }), [digits, currency]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Locale-bound formatters for client components. */
export function useFmt() {
  const locale = useLocale() as AppLocale;
  const { digits, currency } = useContext(Ctx);
  return useMemo(
    () => ({
      locale,
      defaultCurrency: currency,
      date: (d: Date | string | null | undefined) => formatDate(d, locale, digits),
      dateTime: (d: Date | string | null | undefined) => formatDateTime(d, locale, digits),
      money: (v: number | null | undefined, cur = currency) => (v == null ? "—" : formatMoney(v, cur, locale, digits)),
      moneyCompact: (v: number, cur = currency) => formatMoneyCompact(v, cur, locale, digits),
      number: (v: number | null | undefined, fd = 0) => (v == null ? "—" : formatNumber(v, locale, digits, fd)),
      /** Pick the localized name from an {nameAr,nameEn} / {labelAr,labelEn} object. */
      name: (o: { nameAr?: string; nameEn?: string; labelAr?: string; labelEn?: string } | null | undefined) =>
        !o ? "—" : locale === "ar" ? (o.nameAr ?? o.labelAr ?? "") : (o.nameEn ?? o.labelEn ?? ""),
    }),
    [locale, digits, currency],
  );
}
