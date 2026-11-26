import "server-only";
import { createTranslator } from "next-intl";
import { db } from "@/lib/db";
import { messagesFor } from "@/i18n/messages";
import { formatDate, formatMoney, todayUTC } from "@/lib/format";
import { computeTrigger, recipientsFor } from "@/lib/notifications/schedule";
import { reminderRecipients } from "@/lib/notifications/task-events";
import { OPEN_REQUEST_STATUSES } from "@/lib/validation/request";
import type { NotificationKind } from "@/generated/prisma/enums";
import { getSettings } from "./settings";
import { emailHtml, sendMail } from "./email";
import { sendDeliveryDigests } from "./delivery-digest";

type Lang = "ar" | "en";

/** Notification enriched with what the UI / digest needs to display it. */
/** Extra details stored with task event notifications. */
export type NotificationMeta = { actorName?: string; oldDate?: string | null; newDate?: string | null; reason?: string; excerpt?: string };

/** Event notifications describe something that happened (not a due-date countdown). */
export const EVENT_KINDS: NotificationKind[] = ["TASK_ASSIGNED", "TASK_DELIVERED", "TASK_DUE_CHANGED", "TASK_MENTION"];

export type NotificationView = {
  id: string;
  kind: NotificationKind;
  entityType: "amc" | "request" | "task";
  event: boolean;
  meta: NotificationMeta | null;
  entityId: string;
  daysBefore: number;
  dueDate: string;
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  client: { id: string; nameAr: string; nameEn: string } | null;
  reference: string;
  title: string | null;
  amount: number | null;
  currency: string | null;
  href: string;
};

/**
 * The daily job (Vercel Cron → /api/cron/daily, or "Run now" in the UI).
 *  1. Refresh AMC line statuses (PENDING ⇄ OVERDUE).
 *  2. Create notifications for upcoming / overdue AMC and requests
 *     (idempotent via the unique (userId, triggerKey) index).
 *  3. Email each recipient one digest of their new alerts (if enabled).
 * Nothing is ever sent to clients here.
 */
export async function runDailyJob(now = new Date()) {
  const today = todayUTC(now);
  const settings = await getSettings();
  const opts = { intervals: settings.notifyIntervals, overdueEveryDays: settings.notifyOverdueEveryDays };
  const horizon = new Date(today.getTime() + Math.max(0, ...settings.notifyIntervals) * 86_400_000);

  const [toOverdue, toPending] = await db.$transaction([
    db.amcScheduleLine.updateMany({ where: { status: "PENDING", dueDate: { lt: today } }, data: { status: "OVERDUE" } }),
    db.amcScheduleLine.updateMany({ where: { status: "OVERDUE", dueDate: { gte: today } }, data: { status: "PENDING" } }),
  ]);

  const admins = (await db.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } })).map((u) => u.id);
  const activeIds = new Set((await db.user.findMany({ where: { active: true }, select: { id: true } })).map((u) => u.id));

  const lines = await db.amcScheduleLine.findMany({
    where: { status: { not: "PAID" }, dueDate: { lte: horizon }, contract: { status: "ACTIVE", amcEnabled: true } },
    select: { id: true, dueDate: true, contract: { select: { client: { select: { id: true, accountManagerId: true } } } } },
  });
  const requests = await db.clientRequest.findMany({
    where: { status: { in: [...OPEN_REQUEST_STATUSES] }, dueDate: { not: null, lte: horizon } },
    select: { id: true, dueDate: true, assigneeId: true, client: { select: { id: true, accountManagerId: true } } },
  });

  const taskWindows = settings.taskReminderDays.length ? settings.taskReminderDays : [3, 1];
  const taskHorizon = new Date(today.getTime() + Math.max(0, ...taskWindows) * 86_400_000);
  const tasks = await db.deliveryTask.findMany({
    where: { status: { notIn: ["DELIVERED", "CLIENT_ACCEPTED"] }, dueDate: { not: null, lte: taskHorizon }, project: { status: { in: ["ACTIVE", "ON_HOLD"] } } },
    select: { id: true, dueDate: true, assignees: { select: { userId: true, role: true } }, project: { select: { client: { select: { id: true, accountManagerId: true } } } } },
  });

  const rows: { userId: string; kind: NotificationKind; entityType: string; entityId: string; clientId: string; dueDate: Date; daysBefore: number; triggerKey: string }[] = [];
  const push = (type: "amc" | "request", id: string, dueDate: Date, clientId: string, responsible: (string | null)[]) => {
    const trig = computeTrigger({ type, id, dueDate }, today, opts);
    if (!trig) return;
    for (const userId of recipientsFor(responsible, admins)) {
      if (!activeIds.has(userId)) continue;
      rows.push({ userId, kind: trig.kind, entityType: type, entityId: id, clientId, dueDate, daysBefore: trig.daysBefore, triggerKey: trig.triggerKey });
    }
  };
  for (const l of lines) push("amc", l.id, l.dueDate, l.contract.client.id, [l.contract.client.accountManagerId]);
  for (const r of requests) push("request", r.id, r.dueDate!, r.client.id, [r.assigneeId, r.client.accountManagerId]);
  const taskOpts = { intervals: taskWindows, overdueEveryDays: settings.notifyOverdueEveryDays };
  for (const tk of tasks) {
    const trig = computeTrigger({ type: "task", id: tk.id, dueDate: tk.dueDate! }, today, taskOpts);
    if (!trig) continue;
    const people = { assignees: tk.assignees, watchers: [], accountManagerId: tk.project.client.accountManagerId };
    for (const userId of reminderRecipients(trig.kind as "TASK_DUE" | "TASK_OVERDUE", people)) {
      if (!activeIds.has(userId)) continue;
      rows.push({ userId, kind: trig.kind, entityType: "task", entityId: tk.id, clientId: tk.project.client.id, dueDate: tk.dueDate!, daysBefore: trig.daysBefore, triggerKey: trig.triggerKey });
    }
  }

  const startedAt = new Date();
  const created = rows.length ? (await db.notification.createMany({ data: rows, skipDuplicates: true })).count : 0;

  const mail = settings.notifyByEmail && created > 0 ? await emailPending({ createdAt: { gte: startedAt } }) : { emailed: 0, errors: [] as string[] };
  const digest = await sendDeliveryDigests(today).catch((e) => ({ sent: 0, errors: [String(e)] }));

  return {
    today: today.toISOString().slice(0, 10),
    amcMarkedOverdue: toOverdue.count,
    amcBackToPending: toPending.count,
    candidates: rows.length,
    notificationsCreated: created,
    digestsEmailed: mail.emailed,
    deliveryDigests: digest.sent,
    emailErrors: [...mail.errors, ...digest.errors],
  };
}

/** Email not-yet-emailed notifications matching `where`, one message per user. */
export async function emailPending(where: { createdAt?: { gte: Date }; id?: { in: string[] } }) {
  const fresh = await db.notification.findMany({
    where: { ...where, emailedAt: null },
    include: { user: { select: { id: true, email: true, name: true, locale: true, active: true } } },
  });
  const byUser = new Map<string, typeof fresh>();
  for (const n of fresh) byUser.set(n.userId, [...(byUser.get(n.userId) ?? []), n]);
  let emailed = 0;
  const errors: string[] = [];
  for (const [, list] of byUser) {
    const user = list[0].user;
    if (!user.active) continue;
    try {
      const views = await enrich(list);
      await sendDigest(user, views);
      await db.notification.updateMany({ where: { id: { in: list.map((n) => n.id) } }, data: { emailedAt: new Date() } });
      emailed++;
    } catch (e) {
      errors.push(`${user.email}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { emailed, errors };
}

/** Attach client / reference / amount details to raw notifications. */
export async function enrich(
  list: { id: string; kind: NotificationKind; entityType: string; entityId: string; daysBefore: number; dueDate: Date; readAt: Date | null; dismissedAt: Date | null; createdAt: Date; meta?: unknown }[],
): Promise<NotificationView[]> {
  const amcIds = list.filter((n) => n.entityType === "amc").map((n) => n.entityId);
  const reqIds = list.filter((n) => n.entityType === "request").map((n) => n.entityId);
  const taskIds = list.filter((n) => n.entityType === "task").map((n) => n.entityId);
  const [amc, reqs, tasks] = await Promise.all([
    db.amcScheduleLine.findMany({
      where: { id: { in: amcIds } },
      select: { id: true, yearIndex: true, amount: true, contract: { select: { id: true, number: true, currency: true, client: { select: { id: true, nameAr: true, nameEn: true } } } } },
    }),
    db.clientRequest.findMany({
      where: { id: { in: reqIds } },
      select: { id: true, number: true, title: true, client: { select: { id: true, nameAr: true, nameEn: true } } },
    }),
    db.deliveryTask.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, title: true, project: { select: { number: true, client: { select: { id: true, nameAr: true, nameEn: true } } } } },
    }),
  ]);
  const taskMap = new Map(tasks.map((x) => [x.id, x]));
  const amcMap = new Map(amc.map((a) => [a.id, a]));
  const reqMap = new Map(reqs.map((r) => [r.id, r]));
  return list.map((n) => {
    const a = n.entityType === "amc" ? amcMap.get(n.entityId) : undefined;
    const r = n.entityType === "request" ? reqMap.get(n.entityId) : undefined;
    const tk = n.entityType === "task" ? taskMap.get(n.entityId) : undefined;
    return {
      id: n.id,
      kind: n.kind,
      entityType: n.entityType as NotificationView["entityType"],
      event: EVENT_KINDS.includes(n.kind),
      meta: (n.meta as NotificationMeta | null | undefined) ?? null,
      entityId: n.entityId,
      daysBefore: n.daysBefore,
      dueDate: n.dueDate.toISOString(),
      readAt: n.readAt?.toISOString() ?? null,
      dismissedAt: n.dismissedAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
      client: a?.contract.client ?? r?.client ?? tk?.project.client ?? null,
      reference: a ? `${a.contract.number} · Y${a.yearIndex}` : (r?.number ?? tk?.project.number ?? "—"),
      title: r?.title ?? tk?.title ?? null,
      amount: a ? Number(a.amount) : null,
      currency: a?.contract.currency ?? null,
      href: a ? `/contracts/${a.contract.id}` : r ? `/requests/${r.id}` : tk ? `/tasks/${tk.id}` : "/notifications",
    };
  });
}

/** Human sentence for a notification (used in UI and digest). */
export function describe(n: NotificationView, lang: Lang) {
  const t = createTranslator({ locale: lang, messages: messagesFor(lang), namespace: "notifications" });
  const client = n.client ? (lang === "ar" ? n.client.nameAr : n.client.nameEn) : "—";
  const days = Math.abs(n.daysBefore);
  const when = n.event
    ? eventDetail(n, lang)
    : n.daysBefore < 0 ? t("overdueBy", { count: days }) : n.daysBefore === 0 ? t("dueToday") : t("dueIn", { count: days });
  const amount = n.amount != null && n.currency ? formatMoney(n.amount, n.currency, lang) : null;
  return { headline: t(`kind_${n.kind}`), client, when, date: formatDate(n.dueDate, lang), amount };
}

/** One-line detail for task event notifications (who did what). */
export function eventDetail(n: Pick<NotificationView, "kind" | "meta" | "dueDate">, lang: Lang) {
  const t = createTranslator({ locale: lang, messages: messagesFor(lang), namespace: "notifications" });
  const m = n.meta ?? {};
  const who = m.actorName ?? "—";
  const d = (x?: string | null) => (x ? formatDate(x, lang) : t("noDate"));
  switch (n.kind) {
    case "TASK_ASSIGNED":
      return t("assignedBy", { name: who, date: d(n.dueDate) });
    case "TASK_DELIVERED":
      return t("deliveredBy", { name: who });
    case "TASK_DUE_CHANGED":
      return t("dueChangedBy", { name: who, from: d(m.oldDate), to: d(m.newDate), reason: m.reason ?? "" });
    case "TASK_MENTION":
      return t("mentionedBy", { name: who, excerpt: m.excerpt ?? "" });
    default:
      return "";
  }
}

async function sendDigest(user: { email: string; name: string; locale: Lang }, items: NotificationView[]) {
  const s = await getSettings();
  const lang = user.locale;
  const t = createTranslator({ locale: lang, messages: messagesFor(lang), namespace: "notifications" });
  const appUrl = process.env.APP_URL ?? "";
  const lines = items.map((n) => {
    const d = describe(n, lang);
    if (n.event) return `• ${d.headline} — ${d.client} — ${n.reference}${n.title ? ` (${n.title})` : ""} — ${d.when}`;
    return `• ${d.headline} — ${d.client} — ${n.reference}${n.title ? ` (${n.title})` : ""} — ${d.date} (${d.when})${d.amount ? ` — ${d.amount}` : ""}`;
  });
  const text = `${t("digestGreeting", { name: user.name })}\n\n${t("digestIntro", { count: items.length })}\n\n${lines.join("\n")}\n\n${t(items.every((n) => n.entityType === "task") ? "digestFooterTasks" : "digestFooter")}${appUrl ? `\n${appUrl}/notifications` : ""}`;
  await sendMail({
    to: [user.email],
    subject: items.length === 1 && items[0].event ? `${t(`kind_${items[0].kind}`)}: ${items[0].title ?? items[0].reference}` : t("digestSubject", { count: items.length }),
    text,
    html: emailHtml(text, { lang, companyName: lang === "ar" ? s.companyNameAr : s.companyNameEn }),
  });
}

export async function listNotifications(userId: string, filter: "unread" | "all" | "dismissed", take = 200) {
  const where =
    filter === "unread"
      ? { userId, readAt: null, dismissedAt: null }
      : filter === "dismissed"
        ? { userId, dismissedAt: { not: null } }
        : { userId, dismissedAt: null };
  const rows = await db.notification.findMany({ where, orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, { dueDate: "asc" }], take });
  return enrich(rows);
}
