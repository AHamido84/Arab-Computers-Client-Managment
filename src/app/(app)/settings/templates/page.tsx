import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { TemplatesEditor, type TemplateEntry } from "@/components/settings/templates-editor";
import { requirePagePermission } from "@/server/auth-guard";
import { db } from "@/lib/db";
import { DEFAULT_DOCUMENT_TEMPLATES, DEFAULT_EMAIL_TEMPLATES } from "@/lib/templates/defaults";

export async function generateMetadata() {
  return { title: (await getTranslations("settings"))("templates") };
}

export default async function TemplatesPage() {
  await requirePagePermission("manageSettings");
  const [t, docs, mails] = await Promise.all([getTranslations("settings"), db.documentTemplate.findMany(), db.emailTemplate.findMany()]);
  const entries: TemplateEntry[] = [];
  for (const [kind, langs] of Object.entries(DEFAULT_DOCUMENT_TEMPLATES))
    for (const lang of ["ar", "en"] as const) {
      const row = docs.find((d) => d.kind === kind && d.lang === lang);
      entries.push({ type: "document", kind, lang, title: row?.title ?? langs[lang].title, body: row?.body ?? langs[lang].body });
    }
  for (const [kind, langs] of Object.entries(DEFAULT_EMAIL_TEMPLATES))
    for (const lang of ["ar", "en"] as const) {
      const row = mails.find((d) => d.kind === kind && d.lang === lang);
      entries.push({ type: "email", kind, lang, title: row?.subject ?? langs[lang].subject, body: row?.body ?? langs[lang].body });
    }
  return (
    <>
      <PageHeader title={t("templates")} description={t("templatesDesc")} />
      <TemplatesEditor templates={entries} />
    </>
  );
}
