"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, AtSign, Bell, CalendarClock, CalendarSync, Check, CircleCheckBig, ClipboardList, Eye, EyeOff, ListTodo, Mail, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFmt } from "@/components/shared/format-provider";
import { useServerAction } from "@/components/forms/use-action";
import { updateNotificationAction } from "@/server/actions/notifications";
import type { NotificationView } from "@/server/services/notifications";
import { cn } from "@/lib/utils";

const ICON = {
  AMC_UPCOMING: CalendarClock, AMC_OVERDUE: AlertTriangle, REQUEST_DUE: ClipboardList, REQUEST_OVERDUE: AlertTriangle,
  TASK_ASSIGNED: ListTodo, TASK_DUE: CalendarClock, TASK_OVERDUE: AlertTriangle, TASK_DELIVERED: CircleCheckBig,
  TASK_DUE_CHANGED: CalendarSync, TASK_MENTION: AtSign,
} as const;

/** One notification row with read / dismiss / prepare-email actions. */
export function NotificationItem({ n, compact, canEmail }: { n: NotificationView; compact?: boolean; canEmail: boolean }) {
  const t = useTranslations("notifications");
  const f = useFmt();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const Icon = ICON[n.kind] ?? Bell;
  const overdue = n.daysBefore < 0;
  const days = Math.abs(n.daysBefore);
  const when = overdue ? t("overdueBy", { count: days }) : n.daysBefore === 0 ? t("dueToday") : t("dueIn", { count: days });
  const op = (o: "read" | "unread" | "dismiss" | "restore") => run(() => updateNotificationAction(n.id, o), { onSuccess: () => router.refresh() });

  return (
    <div className={cn("flex gap-3 rounded-lg p-3", !n.readAt && !n.dismissedAt ? "bg-accent/40" : "", compact ? "p-2" : "border")}>
      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", overdue ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground")}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 text-sm">
          <span className="font-medium">{t(`kind_${n.kind}`)}</span>
          {!n.readAt && !n.dismissedAt && <span className="size-2 rounded-full bg-primary" aria-label={t("unread")} />}
        </div>
        <Link href={n.href} className="block text-sm hover:underline" onClick={() => !n.readAt && op("read")}>
          {n.client ? f.name(n.client) : "—"} · <span dir="ltr">{n.reference}</span>
          {n.title ? ` — ${n.title}` : ""}
        </Link>
        <p className={cn("text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
          {f.date(n.dueDate)} · {when}
          {n.amount != null && n.currency ? <span className="num"> · {f.money(n.amount, n.currency)}</span> : null}
        </p>
        {!compact && (
          <div className="flex flex-wrap gap-1 pt-1">
            {canEmail && n.client && (
              <Button asChild size="xs" variant="default">
                <Link href={`/emails/compose?kind=${n.entityType}&id=${n.entityId}`}>
                  <Mail /> {t("prepareEmail")}
                </Link>
              </Button>
            )}
            <Button asChild size="xs" variant="outline">
              <Link href={n.href} onClick={() => !n.readAt && op("read")}>
                <Eye /> {t("open")}
              </Link>
            </Button>
            {n.dismissedAt ? (
              <Button size="xs" variant="ghost" disabled={pending} onClick={() => op("restore")}>
                <RotateCcw /> {t("restore")}
              </Button>
            ) : (
              <>
                <Button size="xs" variant="ghost" disabled={pending} onClick={() => op(n.readAt ? "unread" : "read")}>
                  {n.readAt ? <EyeOff /> : <Check />} {n.readAt ? t("markUnread") : t("markRead")}
                </Button>
                <Button size="xs" variant="ghost" disabled={pending} onClick={() => op("dismiss")}>
                  <X /> {t("dismiss")}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
