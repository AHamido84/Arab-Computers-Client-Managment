import "server-only";
import { formatDate, formatMoney, todayUTC } from "@/lib/format";
import { currencyName } from "@/lib/format";
import { computeTotals } from "@/lib/totals";
import type { TemplateVars } from "@/lib/templates/render";
import { getSettings } from "./settings";

type Lang = "ar" | "en";

/** Company + client variables shared by every template. Documents always use Latin digits. */
export async function baseVars(lang: Lang, client: { nameAr: string; nameEn: string; contacts?: { name: string; isPrimary: boolean }[] }): Promise<TemplateVars> {
  const s = await getSettings();
  const contact = client.contacts?.find((c) => c.isPrimary) ?? client.contacts?.[0];
  return {
    company_name: lang === "ar" ? s.companyNameAr : s.companyNameEn,
    company_phone: s.phone,
    company_email: s.email,
    company_website: s.website,
    today: formatDate(todayUTC(), lang),
    client_name: lang === "ar" ? client.nameAr : client.nameEn,
    contact_name: contact?.name ?? (lang === "ar" ? client.nameAr : client.nameEn),
  };
}

export async function quotationVars(q: {
  number: string;
  version: number;
  issueDate: Date;
  validUntil: Date;
  currency: string;
  lang: Lang;
  discount: unknown;
  vatPercent: unknown;
  items: { qty: unknown; unitPrice: unknown }[];
  client: { nameAr: string; nameEn: string; contacts?: { name: string; isPrimary: boolean }[] };
}): Promise<TemplateVars> {
  const totals = computeTotals(q.items as never, q.discount as never, q.vatPercent as never);
  return {
    ...(await baseVars(q.lang, q.client)),
    quotation_number: q.version > 1 ? `${q.number} v${q.version}` : q.number,
    quotation_version: q.version,
    quotation_date: formatDate(q.issueDate, q.lang),
    valid_until: formatDate(q.validUntil, q.lang),
    quotation_total: formatMoney(totals.total, q.currency, q.lang),
    currency: currencyName(q.currency, q.lang),
  };
}
