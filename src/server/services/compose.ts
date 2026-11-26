import "server-only";
import { db } from "@/lib/db";
import { fillPlaceholders, type TemplateVars } from "@/lib/templates/render";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/templates/defaults";
import type { EmailTemplateKind } from "@/generated/prisma/enums";
import { createTranslator } from "next-intl";
import { messagesFor } from "@/i18n/messages";
import { formatDate } from "@/lib/format";
import type { DocKind } from "./documents";
import { amcVars, baseVars, contractVars, quotationVars } from "./template-vars";

/** Kinds that can be emailed. "request" emails have no PDF attachment. */
export type ComposeKind = DocKind | "request";
export const COMPOSE_KINDS: ComposeKind[] = ["contract", "amc", "quotation", "request"];

type Lang = "ar" | "en";

export type ComposeDraft = {
  kind: ComposeKind;
  id: string;
  lang: Lang;
  templateKind: EmailTemplateKind;
  client: { id: string; nameAr: string; nameEn: string; preferredLang: Lang };
  contacts: { name: string; email: string; isPrimary: boolean }[];
  defaultTo: string[];
  subject: string;
  body: string;
  attachmentName: string;
  reference: string;
  quotationStatus?: string;
};

async function emailTemplate(kind: EmailTemplateKind, lang: Lang) {
  const row = await db.emailTemplate.findUnique({ where: { kind_lang: { kind, lang } } });
  return row ?? DEFAULT_EMAIL_TEMPLATES[kind][lang];
}

/** Build a ready-to-edit email (subject/body filled, recipients suggested). Nothing is sent here. */
export async function prepareEmail(kind: ComposeKind, id: string, langOverride?: Lang): Promise<ComposeDraft | null> {
  let client: ComposeDraft["client"] & { contacts: { name: string; email: string | null; isPrimary: boolean }[] };
  let vars: TemplateVars;
  let templateKind: EmailTemplateKind;
  let reference: string;
  let attachmentBase: string;
  let quotationStatus: string | undefined;
  let lang: Lang;

  if (kind === "request") {
    const r = await db.clientRequest.findUnique({ where: { id }, include: { client: { include: { contacts: true } } } });
    if (!r) return null;
    lang = langOverride ?? r.client.preferredLang;
    client = r.client;
    const t = createTranslator({ locale: lang, messages: messagesFor(lang), namespace: "requestStatus" });
    vars = {
      ...(await baseVars(lang, r.client)),
      request_number: r.number,
      request_title: r.title,
      request_status: t(r.status),
      due_date: r.dueDate ? formatDate(r.dueDate, lang) : "—",
    };
    templateKind = "REQUEST_UPDATE";
    reference = r.number;
    attachmentBase = "";
  } else if (kind === "quotation") {
    const q = await db.quotation.findUnique({ where: { id }, include: { client: { include: { contacts: true } }, items: true } });
    if (!q) return null;
    lang = langOverride ?? q.lang;
    client = q.client;
    vars = await quotationVars({ ...q, lang });
    templateKind = "QUOTATION";
    reference = q.version > 1 ? `${q.number} v${q.version}` : q.number;
    attachmentBase = reference;
    quotationStatus = q.status;
  } else {
    const line = kind === "amc" ? await db.amcScheduleLine.findUnique({ where: { id } }) : null;
    if (kind === "amc" && !line) return null;
    const c = await db.contract.findUnique({
      where: { id: line?.contractId ?? id },
      include: { client: { include: { contacts: true } }, products: { include: { product: true } } },
    });
    if (!c) return null;
    lang = langOverride ?? c.client.preferredLang;
    client = c.client;
    if (line) {
      vars = await amcVars(line, c, lang);
      templateKind = line.status === "OVERDUE" ? "AMC_OVERDUE" : "AMC_REMINDER";
      reference = `${c.number}-Y${line.yearIndex}`;
      attachmentBase = `AMC-${reference}`;
    } else {
      vars = await contractVars(c, lang);
      templateKind = "CONTRACT";
      reference = c.number;
      attachmentBase = c.number;
    }
  }

  const tpl = await emailTemplate(templateKind, lang);
  const contacts = client.contacts
    .filter((c) => c.email)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
    .map((c) => ({ name: c.name, email: c.email!, isPrimary: c.isPrimary }));
  const primary = contacts.filter((c) => c.isPrimary).map((c) => c.email);

  return {
    kind,
    id,
    lang,
    templateKind,
    client: { id: client.id, nameAr: client.nameAr, nameEn: client.nameEn, preferredLang: client.preferredLang },
    contacts,
    defaultTo: primary.length ? primary : contacts.slice(0, 1).map((c) => c.email),
    subject: fillPlaceholders(tpl.subject, vars),
    body: fillPlaceholders(tpl.body, vars),
    attachmentName: attachmentBase ? `${attachmentBase.replace(/[^\p{L}\p{N}._-]+/gu, "-")}-${lang}.pdf` : "",
    reference,
    quotationStatus,
  };
}
