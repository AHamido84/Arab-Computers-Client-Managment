import "server-only";
import { createTranslator } from "next-intl";
import { db } from "@/lib/db";
import { messagesFor } from "@/i18n/messages";
import { formatDate } from "@/lib/format";
import { digestBuckets } from "@/lib/notifications/task-events";
import { getSettings } from "./settings";
import { emailHtml, sendMail } from "./email";

type Lang = "ar" | "en";

/**
 * Daily delivery digest for admins (all projects) and account managers (their
 * clients' projects): tasks due today, overdue tasks, tasks delivered
 * yesterday. Sent at most once per person per day; nothing is sent when all
 * three lists are empty.
 */
export async function sendDeliveryDigests(today: Date) {
  const settings = await getSettings();
  if (!settings.deliveryDigest) return { sent: 0, errors: [] as string[] };
  const yesterday = new Date(today.getTime() - 86_400_000);
  const tasks = await db.deliveryTask.findMany({
    where: {
      project: { status: { not: "CANCELLED" } },
      OR: [{ status: { notIn: ["DELIVERED", "CLIENT_ACCEPTED"] }, dueDate: { lte: today } }, { deliveredAt: { gte: yesterday, lt: today } }],
    },
    select: {
      id: true, title: true, status: true, dueDate: true, deliveredAt: true,
      project: { select: { number: true, client: { select: { nameAr: true, nameEn: true, accountManagerId: true } } } },
      assignees: { select: { role: true, user: { select: { name: true } } }, orderBy: { role: "asc" } },
    },
  });
  const users = await db.user.findMany({ where: { active: true, role: { in: ["ADMIN", "ACCOUNT_MANAGER"] } }, select: { id: true, name: true, email: true, role: true, locale: true } });
  const day = today.toISOString().slice(0, 10);
  let sent = 0;
  const errors: string[] = [];
  for (const u of users) {
    const mine = u.role === "ADMIN" ? tasks : tasks.filter((t) => t.project.client.accountManagerId === u.id);
    const b = digestBuckets(mine, today);
    if (!b.dueToday.length && !b.overdue.length && !b.deliveredYesterday.length) continue;
    // Once per person per day (the Counter table doubles as a send log).
    const scope = `digest:delivery:${day}:${u.id}`;
    const fresh = await db.counter.createMany({ data: [{ scope, value: 1 }], skipDuplicates: true });
    if (!fresh.count) continue;
    try {
      await sendMail(digestMail(u, b, settings));
      sent++;
    } catch (e) {
      await db.counter.delete({ where: { scope } }).catch(() => {});
      errors.push(`${u.email}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { sent, errors };
}

type Row = { title: string; dueDate: Date | null; deliveredAt: Date | null; project: { number: string; client: { nameAr: string; nameEn: string } }; assignees: { role: string; user: { name: string } }[] };

function digestMail(
  u: { name: string; email: string; locale: Lang },
  b: { dueToday: Row[]; overdue: Row[]; deliveredYesterday: Row[] },
  s: { companyNameAr: string; companyNameEn: string },
) {
  const lang = u.locale;
  const t = createTranslator({ locale: lang, messages: messagesFor(lang), namespace: "deliveryDigest" });
  const line = (r: Row, extra: string) => {
    const who = r.assignees.map((a) => a.user.name).join(", ") || t("unassigned");
    return `• ${r.title} — ${r.project.number} — ${lang === "ar" ? r.project.client.nameAr : r.project.client.nameEn} — ${who}${extra ? ` — ${extra}` : ""}`;
  };
  const section = (title: string, rows: Row[], extra: (r: Row) => string) => (rows.length ? `${title} (${rows.length})\n${rows.map((r) => line(r, extra(r))).join("\n")}` : "");
  const appUrl = process.env.APP_URL ?? "";
  const text = [
    t("greeting", { name: u.name }),
    t("intro"),
    section(t("dueToday"), b.dueToday, () => ""),
    section(t("overdue"), b.overdue, (r) => t("wasDue", { date: formatDate(r.dueDate, lang) })),
    section(t("deliveredYesterday"), b.deliveredYesterday, () => ""),
    appUrl ? `${t("open")}\n${appUrl}/tasks` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    to: [u.email],
    subject: t("subject", { today: b.dueToday.length, overdue: b.overdue.length, delivered: b.deliveredYesterday.length }),
    text,
    html: emailHtml(text, { lang, companyName: lang === "ar" ? s.companyNameAr : s.companyNameEn }),
  };
}
