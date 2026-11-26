"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sendEmailSchema, type SendEmailInput } from "@/lib/validation/email";
import { requirePermission } from "@/server/auth-guard";
import { DomainError, runAction } from "@/server/action-result";
import { activity, audit } from "@/server/services/audit";
import { buildDocument } from "@/server/services/documents";
import { emailHtml, emailStatus, sendMail, type MailAttachment } from "@/server/services/email";
import { prepareEmail } from "@/server/services/compose";
import { getSettings } from "@/server/services/settings";
import { saveFile } from "@/server/services/storage";

/**
 * Send a reviewed email to a client. Only ever triggered by a user clicking
 * "Send" — nothing goes to clients automatically. Every attempt is logged.
 */
export async function sendEmailAction(input: SendEmailInput) {
  return runAction(async () => {
    const user = await requirePermission("sendEmail");
    const data = sendEmailSchema.parse(input);
    const draft = await prepareEmail(data.kind, data.id, data.lang);
    if (!draft) throw new DomainError("errors.notFound");
    const settings = await getSettings();

    let attachment: MailAttachment | null = null;
    let storedUrl: string | null = null;
    if (data.attach && data.kind !== "request") {
      const doc = await buildDocument(data.kind, data.id, data.lang);
      if (!doc) throw new DomainError("errors.notFound");
      attachment = { filename: doc.filename, content: doc.buffer, contentType: "application/pdf" };
      storedUrl = (await saveFile(`emails/${draft.client.id}`, doc.filename, doc.buffer, "application/pdf")).url;
    }

    const html = emailHtml(data.body, {
      lang: data.lang,
      companyName: data.lang === "ar" ? settings.companyNameAr : settings.companyNameEn,
      footer: [settings.phone, settings.email, settings.website].filter(Boolean).join(" · "),
    });

    let result: Awaited<ReturnType<typeof sendMail>> | null = null;
    let error: string | null = null;
    try {
      result = await sendMail({ to: data.to, cc: data.cc, subject: data.subject, text: data.body, html, attachments: attachment ? [attachment] : [] });
    } catch (e) {
      if (e instanceof DomainError) throw e;
      error = e instanceof Error ? e.message : String(e);
      console.error("email send failed", e);
    }

    const relatedType = data.kind;
    const log = await db.$transaction(async (tx) => {
      const row = await tx.emailLog.create({
        data: {
          clientId: draft.client.id,
          to: data.to,
          cc: data.cc,
          subject: data.subject,
          body: data.body,
          attachmentName: attachment?.filename ?? null,
          attachmentUrl: storedUrl,
          relatedType,
          relatedId: data.id,
          provider: result?.provider ?? (await emailStatus()).provider.toLowerCase(),
          providerMessageId: result?.messageId ?? null,
          status: result ? "SENT" : "FAILED",
          error,
          sentById: user.id,
        },
      });
      if (result) {
        await activity(tx, {
          clientId: draft.client.id,
          type: "email.sent",
          summary: data.subject,
          refType: "email",
          refId: row.id,
          actorId: user.id,
          meta: { to: data.to, attachment: attachment?.filename ?? null },
        });
        if (data.kind === "quotation" && data.markQuotationSent) {
          const q = await tx.quotation.findUnique({ where: { id: data.id } });
          if (q?.status === "DRAFT") {
            const after = await tx.quotation.update({ where: { id: q.id }, data: { status: "SENT", sentAt: new Date() } });
            await audit(tx, { actorId: user.id, action: "UPDATE", entity: "Quotation", entityId: q.id, before: q, after });
          }
        }
        // The email handles the reminder: clear open alerts for this AMC line.
        if (data.kind === "amc") {
          await tx.notification.updateMany({ where: { entityType: "amc", entityId: data.id, readAt: null }, data: { readAt: new Date() } });
        }
      }
      return row;
    });

    revalidatePath(`/clients/${draft.client.id}`);
    revalidatePath("/emails");
    if (data.kind === "quotation") revalidatePath(`/quotations/${data.id}`);
    if (!result) throw new DomainError("email.sendFailed");
    return { id: log.id, clientId: draft.client.id, provider: result.provider };
  });
}

/** Send a test email to the current admin to verify provider settings. */
export async function sendTestEmailAction() {
  return runAction(async () => {
    const user = await requirePermission("manageSettings");
    const s = await getSettings();
    const lang = user.locale;
    const text =
      lang === "ar"
        ? "هذه رسالة تجريبية من نظام إدارة العملاء.\n\nإذا وصلتك هذه الرسالة فإعدادات البريد تعمل بشكل صحيح."
        : "This is a test message from the client management system.\n\nIf you received it, email settings work correctly.";
    const r = await sendMail({
      to: [user.email!],
      subject: lang === "ar" ? "رسالة تجريبية" : "Test email",
      text,
      html: emailHtml(text, { lang, companyName: lang === "ar" ? s.companyNameAr : s.companyNameEn }),
    });
    return { email: user.email!, provider: r.provider };
  });
}
