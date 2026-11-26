import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createTranslator } from "next-intl";
import { db } from "@/lib/db";
import { messagesFor } from "@/i18n/messages";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { computeTotals, lineTotal } from "@/lib/totals";
import { fillPlaceholders } from "@/lib/templates/render";
import { registerPdfFonts } from "@/pdf/fonts";
import { AmcNoticePdf, ContractPdf, QuotationPdf, type Labels } from "@/pdf/templates";
import type { Company, Lang } from "@/pdf/letterhead";
import { getSettings } from "./settings";
import { getDocumentTemplates } from "./templates";
import { readFileBuffer } from "./storage";
import { amcVars, contractVars, productsText, quotationVars } from "./template-vars";

export type DocKind = "contract" | "amc" | "quotation";
export const DOC_KINDS: DocKind[] = ["contract", "amc", "quotation"];

export type BuiltDocument = { buffer: Buffer; filename: string; lang: Lang; clientId: string; title: string };

async function letterhead(lang: Lang): Promise<{ company: Company; logo: Buffer | null }> {
  const s = await getSettings();
  let logo: Buffer | null = null;
  if (s.logoUrl) logo = await readFileBuffer(s.logoUrl).catch(() => null);
  if (!logo) logo = await fs.readFile(path.join(process.cwd(), "public/brand/logo.png")).catch(() => null);
  return {
    logo,
    company: {
      name: lang === "ar" ? s.companyNameAr : s.companyNameEn,
      address: lang === "ar" ? s.addressAr : s.addressEn,
      phone: s.phone,
      email: s.email,
      website: s.website,
      taxNumber: s.taxNumber,
      commercialRegister: s.commercialRegister,
      footer: lang === "ar" ? s.letterheadFooterAr : s.letterheadFooterEn,
    },
  };
}

function labels(lang: Lang, companyName: string): Labels {
  const t = createTranslator({ locale: lang, messages: messagesFor(lang), namespace: "pdf" });
  const keys = ["to", "attn", "date", "ref", "item", "scope", "delivery", "qty", "unitPrice", "total", "subtotal", "discount", "grandTotal", "validUntil", "terms", "amcSchedule", "year", "dueDate", "amount", "forClient", "signature", "name", "stamp", "contractNo", "quotationNo", "noticeNo", "maintenanceYear", "contractValue", "systems", "taxNo", "cr", "amountDue", "client"] as const;
  const out = Object.fromEntries(keys.map((k) => [k, t(k)])) as Record<string, string>;
  out.forCompanyName = t("forCompany", { name: companyName });
  return Object.assign(out, { pageFn: (page: number, pages: number) => t("page", { page, pages }) }) as unknown as Labels;
}

const safe = (s: string) => s.replace(/[^\p{L}\p{N}._-]+/gu, "-");

async function render(el: React.ReactElement) {
  registerPdfFonts();
  return renderToBuffer(el as never);
}

/** Build a PDF. `lang` defaults to the client's preferred language. */
export async function buildDocument(kind: DocKind, id: string, langOverride?: Lang): Promise<BuiltDocument | null> {
  if (kind === "quotation") {
    const q = await db.quotation.findUnique({
      where: { id },
      include: { client: { include: { contacts: true } }, items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!q) return null;
    const lang = langOverride ?? q.lang;
    const { company, logo } = await letterhead(lang);
    const L = labels(lang, company.name);
    const vars = await quotationVars({ ...q, lang });
    const tpl = (await getDocumentTemplates("QUOTATION"))[lang];
    const totals = computeTotals(q.items, q.discount, q.vatPercent);
    const m = (v: number) => formatMoney(v, q.currency, lang);
    const t = createTranslator({ locale: lang, messages: messagesFor(lang), namespace: "pdf" });
    const number = q.version > 1 ? `${q.number} v${q.version}` : q.number;
    const totalRows: [string, string, boolean?][] = [[L.subtotal, m(totals.subtotal)]];
    if (totals.discount > 0) totalRows.push([L.discount, m(-totals.discount)]);
    totalRows.push([t("vat", { rate: formatNumber(totals.vatPercent, lang) }), m(totals.vat)], [L.grandTotal, m(totals.total), true]);
    const buffer = await render(
      createElement(QuotationPdf, {
        lang, company, logo, L,
        title: tpl.title,
        number,
        date: formatDate(q.issueDate, lang),
        validUntil: formatDate(q.validUntil, lang),
        client: lang === "ar" ? q.client.nameAr : q.client.nameEn,
        contact: String(vars.contact_name ?? ""),
        subject: q.title,
        // The quotation's own intro (edited per quotation) wins over the template.
        intro: fillPlaceholders(q.introText ?? tpl.body, vars),
        items: q.items.map((i, idx) => ({
          n: String(idx + 1),
          title: i.title,
          scope: i.scope,
          delivery: i.dueDate ? formatDate(i.dueDate, lang) : "—",
          qty: formatNumber(i.qty, lang),
          unitPrice: m(Number(i.unitPrice)),
          total: m(lineTotal(i)),
        })),
        totals: totalRows,
        terms: fillPlaceholders(q.terms, vars),
      }),
    );
    return { buffer, lang, clientId: q.clientId, title: `${tpl.title} ${number}`, filename: `${safe(number)}-${lang}.pdf` };
  }

  // Contract and AMC notice share the contract data.
  const amcLine = kind === "amc" ? await db.amcScheduleLine.findUnique({ where: { id } }) : null;
  if (kind === "amc" && !amcLine) return null;
  const contractId = amcLine?.contractId ?? id;
  const c = await db.contract.findUnique({
    where: { id: contractId },
    include: { client: { include: { contacts: true } }, products: { include: { product: true } }, amcLines: { orderBy: { yearIndex: "asc" } } },
  });
  if (!c) return null;
  const lang = langOverride ?? c.client.preferredLang;
  const { company, logo } = await letterhead(lang);
  const L = labels(lang, company.name);
  const m = (v: unknown) => formatMoney(Number(v), c.currency, lang);
  const clientName = lang === "ar" ? c.client.nameAr : c.client.nameEn;

  if (kind === "contract") {
    const vars = await contractVars(c, lang);
    const tpl = (await getDocumentTemplates("CONTRACT"))[lang];
    const buffer = await render(
      createElement(ContractPdf, {
        lang, company, logo, L,
        title: fillPlaceholders(tpl.title, vars),
        number: c.number,
        date: formatDate(c.contractDate, lang),
        client: clientName,
        contact: String(vars.contact_name ?? ""),
        summary: [
          [L.systems, productsText(c, lang)],
          [L.contractValue, m(c.value)],
        ],
        body: fillPlaceholders(tpl.body, vars),
        amc: c.amcEnabled ? c.amcLines.map((l) => ({ year: String(l.yearIndex), due: formatDate(l.dueDate, lang), amount: m(l.amount) })) : null,
      }),
    );
    return { buffer, lang, clientId: c.clientId, title: `${tpl.title} ${c.number}`, filename: `${safe(c.number)}-${lang}.pdf` };
  }

  const line = amcLine!;
  const vars = await amcVars(line, c, lang);
  const tpl = (await getDocumentTemplates("AMC_RENEWAL"))[lang];
  const ref = `${c.number}-Y${line.yearIndex}`;
  const buffer = await render(
    createElement(AmcNoticePdf, {
      lang, company, logo, L,
      title: fillPlaceholders(tpl.title, vars),
      reference: ref,
      date: String(vars.today),
      client: clientName,
      contact: String(vars.contact_name ?? ""),
      summary: [
        [L.contractNo, c.number],
        [L.systems, productsText(c, lang)],
        [L.maintenanceYear, String(line.yearIndex)],
        [L.dueDate, formatDate(line.dueDate, lang)],
      ],
      body: fillPlaceholders(tpl.body, vars),
      amountDue: m(line.amount),
    }),
  );
  return { buffer, lang, clientId: c.clientId, title: `${tpl.title} ${ref}`, filename: `AMC-${safe(ref)}-${lang}.pdf` };
}
