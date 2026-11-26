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

type ContractLike = {
  number: string;
  contractDate: Date;
  startDate: Date;
  value: unknown;
  currency: string;
  paymentTerms: string | null;
  amcPercent: unknown;
  amcIncreasePercent: unknown;
  amcMethod: "COMPOUND" | "SIMPLE";
  amcStartDate: Date | null;
  products: { product: { labelAr: string; labelEn: string } }[];
  client: { nameAr: string; nameEn: string; contacts?: { name: string; isPrimary: boolean }[] };
};

const METHOD = {
  ar: { COMPOUND: "تراكمية على السنة السابقة", SIMPLE: "بسيطة على قيمة الصيانة الأساسية" },
  en: { COMPOUND: "compounded on the previous year", SIMPLE: "simple, on the base AMC" },
} as const;

export function productsText(c: Pick<ContractLike, "products">, lang: Lang) {
  return c.products.map((p) => (lang === "ar" ? p.product.labelAr : p.product.labelEn)).join(lang === "ar" ? "، " : ", ");
}

export async function contractVars(c: ContractLike, lang: Lang): Promise<TemplateVars> {
  const { defaultAmcStartDate } = await import("@/lib/amc/engine");
  return {
    ...(await baseVars(lang, c.client)),
    contract_number: c.number,
    contract_date: formatDate(c.contractDate, lang),
    contract_start_date: formatDate(c.startDate, lang),
    contract_value: formatMoney(Number(c.value), c.currency, lang),
    currency: currencyName(c.currency, lang),
    products: productsText(c, lang),
    payment_terms: c.paymentTerms ?? "—",
    amc_percent: String(Number(c.amcPercent)),
    amc_increase_percent: String(Number(c.amcIncreasePercent)),
    amc_method: METHOD[lang][c.amcMethod],
    amc_start_date: formatDate(c.amcStartDate ?? defaultAmcStartDate(c.contractDate), lang),
  };
}

export async function amcVars(
  line: { yearIndex: number; dueDate: Date; amount: unknown },
  contract: ContractLike,
  lang: Lang,
): Promise<TemplateVars> {
  const today = todayUTC();
  const days = Math.round((line.dueDate.getTime() - today.getTime()) / 86_400_000);
  return {
    ...(await contractVars(contract, lang)),
    amc_year: String(line.yearIndex),
    amc_amount: formatMoney(Number(line.amount), contract.currency, lang),
    due_date: formatDate(line.dueDate, lang),
    days_remaining: String(Math.max(0, days)),
    days_overdue: String(Math.max(0, -days)),
  };
}
