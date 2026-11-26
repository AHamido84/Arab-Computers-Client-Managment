import { getTranslations } from "next-intl/server";
import { formatMoney, formatNumber, type DigitStyle } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";
import type { Totals } from "@/lib/totals";

/** Server-rendered totals block (detail pages). */
export async function TotalsBlock({ totals, currency, locale, digits }: { totals: Totals; currency: string; locale: AppLocale; digits: DigitStyle }) {
  const t = await getTranslations("common");
  const m = (v: number) => formatMoney(v, currency, locale, digits);
  return (
    <dl className="ms-auto w-full max-w-sm space-y-1.5 text-sm">
      <div className="flex justify-between gap-6">
        <dt className="text-muted-foreground">{t("subtotal")}</dt>
        <dd className="num">{m(totals.subtotal)}</dd>
      </div>
      {totals.discount > 0 && (
        <div className="flex justify-between gap-6">
          <dt className="text-muted-foreground">{t("discount")}</dt>
          <dd className="num">{m(-totals.discount)}</dd>
        </div>
      )}
      <div className="flex justify-between gap-6">
        <dt className="text-muted-foreground">
          {t("vat")} ({formatNumber(totals.vatPercent, locale, digits)}%)
        </dt>
        <dd className="num">{m(totals.vat)}</dd>
      </div>
      <div className="flex justify-between gap-6 border-t pt-2 text-base font-semibold">
        <dt>{t("grandTotal")}</dt>
        <dd className="num">{m(totals.total)}</dd>
      </div>
    </dl>
  );
}
