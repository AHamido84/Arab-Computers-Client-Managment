"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { companySettingsSchema, notificationSettingsSchema, templateSchema, type CompanySettingsInput, type NotificationSettingsInput } from "@/lib/validation/settings";
import { DEFAULT_DOCUMENT_TEMPLATES, DEFAULT_EMAIL_TEMPLATES } from "@/lib/templates/defaults";
import { requirePermission } from "@/server/auth-guard";
import { runAction } from "@/server/action-result";
import { audit } from "@/server/services/audit";
import { getSettings } from "@/server/services/settings";
import type { DocumentKind, EmailTemplateKind, Locale } from "@/generated/prisma/enums";

export async function saveCompanySettingsAction(input: CompanySettingsInput) {
  return runAction(async () => {
    const user = await requirePermission("manageSettings");
    const data = companySettingsSchema.parse(input);
    const before = await getSettings();
    const after = await db.settings.update({ where: { id: "default" }, data });
    await audit(db, { actorId: user.id, action: "UPDATE", entity: "Settings", entityId: "default", before, after });
    revalidatePath("/", "layout");
  });
}

export async function saveNotificationSettingsAction(input: NotificationSettingsInput) {
  return runAction(async () => {
    const user = await requirePermission("manageSettings");
    const data = notificationSettingsSchema.parse(input);
    const before = await getSettings();
    const after = await db.settings.update({ where: { id: "default" }, data });
    await audit(db, { actorId: user.id, action: "UPDATE", entity: "Settings", entityId: "default", before, after });
    revalidatePath("/settings/notifications");
  });
}

export async function removeLogoAction() {
  return runAction(async () => {
    await requirePermission("manageSettings");
    await db.settings.update({ where: { id: "default" }, data: { logoUrl: null } });
    revalidatePath("/settings/company");
  });
}

export async function saveDocumentTemplateAction(kind: DocumentKind, lang: Locale, input: { title: string; body: string }) {
  return runAction(async () => {
    const user = await requirePermission("manageSettings");
    const data = templateSchema.parse(input);
    const before = await db.documentTemplate.findUnique({ where: { kind_lang: { kind, lang } } });
    const after = await db.documentTemplate.upsert({ where: { kind_lang: { kind, lang } }, create: { kind, lang, ...data }, update: data });
    await audit(db, { actorId: user.id, action: before ? "UPDATE" : "CREATE", entity: "DocumentTemplate", entityId: after.id, before, after });
    revalidatePath("/settings/templates");
  });
}

export async function saveEmailTemplateAction(kind: EmailTemplateKind, lang: Locale, input: { title: string; body: string }) {
  return runAction(async () => {
    const user = await requirePermission("manageSettings");
    const { title: subject, body } = templateSchema.parse(input);
    const before = await db.emailTemplate.findUnique({ where: { kind_lang: { kind, lang } } });
    const after = await db.emailTemplate.upsert({ where: { kind_lang: { kind, lang } }, create: { kind, lang, subject, body }, update: { subject, body } });
    await audit(db, { actorId: user.id, action: before ? "UPDATE" : "CREATE", entity: "EmailTemplate", entityId: after.id, before, after });
    revalidatePath("/settings/templates");
  });
}

/** Returns the built-in default so the editor can restore it (user still has to save). */
export async function getDefaultTemplateAction(type: "document" | "email", kind: string, lang: Locale) {
  await requirePermission("manageSettings");
  if (type === "document") {
    const d = DEFAULT_DOCUMENT_TEMPLATES[kind as DocumentKind][lang];
    return { title: d.title, body: d.body };
  }
  const e = DEFAULT_EMAIL_TEMPLATES[kind as EmailTemplateKind][lang];
  return { title: e.subject, body: e.body };
}
