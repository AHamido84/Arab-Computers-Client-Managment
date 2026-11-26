import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { DomainError } from "@/server/action-result";
import { getSettings } from "./settings";

/**
 * Email transport. Provider is chosen in Settings (RESEND | SMTP); secrets come
 * from environment variables only. In development, when the chosen provider has
 * no credentials, messages are written to .uploads/outbox instead of being sent.
 */
export type MailAttachment = { filename: string; content: Buffer; contentType: string };
export type Mail = {
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string | null;
  attachments?: MailAttachment[];
};
export type SendResult = { provider: string; messageId: string | null };

const REQUIRED = { RESEND: ["RESEND_API_KEY"], SMTP: ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"] } as const;

export const devOutboxEnabled = () => process.env.EMAIL_DEV_OUTBOX === "1" || process.env.NODE_ENV !== "production";

export async function emailStatus() {
  const s = await getSettings();
  const missing = REQUIRED[s.emailProvider].filter((v) => !process.env[v]);
  return { provider: s.emailProvider, configured: missing.length === 0, missing, devOutbox: missing.length > 0 && devOutboxEnabled() };
}

export async function sendMail(mail: Mail): Promise<SendResult> {
  const s = await getSettings();
  const status = await emailStatus();
  const from = s.emailFrom || `${s.companyNameEn} <no-reply@${s.website || "example.com"}>`;
  const replyTo = mail.replyTo ?? s.emailReplyTo ?? undefined;

  if (!status.configured) {
    if (status.devOutbox) return writeOutbox({ ...mail, replyTo }, from);
    throw new DomainError("email.notConfigured");
  }

  if (s.emailProvider === "RESEND") {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from,
      to: mail.to,
      cc: mail.cc?.length ? mail.cc : undefined,
      replyTo,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: mail.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
    });
    if (error) throw new Error(`Resend: ${error.message}`);
    return { provider: "resend", messageId: data?.id ?? null };
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  const info = await transport.sendMail({
    from,
    to: mail.to,
    cc: mail.cc,
    replyTo,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    attachments: mail.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
  });
  return { provider: "smtp", messageId: info.messageId ?? null };
}

async function writeOutbox(mail: Mail, from: string): Promise<SendResult> {
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${Math.random().toString(36).slice(2, 7)}`;
  const dir = path.join(process.cwd(), ".uploads", "outbox", id);
  await fs.mkdir(dir, { recursive: true });
  const { attachments, ...rest } = mail;
  await fs.writeFile(path.join(dir, "message.json"), JSON.stringify({ from, ...rest, attachments: attachments?.map((a) => a.filename) }, null, 2));
  if (mail.html) await fs.writeFile(path.join(dir, "message.html"), mail.html);
  for (const a of attachments ?? []) await fs.writeFile(path.join(dir, a.filename), a.content);
  console.info(`[email:outbox] ${mail.subject} → ${mail.to.join(", ")} (${dir})`);
  return { provider: "outbox", messageId: id };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Simple branded HTML version of a plain-text email (RTL aware). */
export function emailHtml(text: string, opts: { lang: "ar" | "en"; companyName: string; footer?: string | null }) {
  const dir = opts.lang === "ar" ? "rtl" : "ltr";
  const align = opts.lang === "ar" ? "right" : "left";
  const body = text
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!doctype html><html lang="${opts.lang}" dir="${dir}"><body style="margin:0;background:#f3f6fb;padding:24px 12px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#0f1b33">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #dde3ec">
<tr><td style="background:#183878;padding:16px 24px;color:#ffffff;font-size:18px;font-weight:700;text-align:${align}" dir="${dir}">${esc(opts.companyName)}</td></tr>
<tr><td style="height:4px;background:#00a8d0"></td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.7;text-align:${align}" dir="${dir}">${body}</td></tr>
${opts.footer ? `<tr><td style="padding:12px 24px;background:#f8fafc;color:#5b6b85;font-size:12px;text-align:center" dir="${dir}">${esc(opts.footer)}</td></tr>` : ""}
</table></body></html>`;
}
