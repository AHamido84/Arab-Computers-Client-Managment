import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { NotificationItem } from "@/components/notifications/notification-item";
import { NotificationsToolbar } from "@/components/notifications/notifications-toolbar";
import { can, requireUser } from "@/server/auth-guard";
import { listNotifications } from "@/server/services/notifications";
import { getSettings } from "@/server/services/settings";
import { db } from "@/lib/db";

export async function generateMetadata() {
  return { title: (await getTranslations("notifications"))("title") };
}

const FILTERS = ["unread", "all", "dismissed"] as const;

export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  const user = await requireUser();
  const sp = (await searchParams) as { filter?: string };
  const filter = (FILTERS as readonly string[]).includes(sp.filter ?? "") ? (sp.filter as (typeof FILTERS)[number]) : "unread";
  const [t, items, settings, unread] = await Promise.all([
    getTranslations("notifications"),
    listNotifications(user.id, filter),
    getSettings(),
    db.notification.count({ where: { userId: user.id, readAt: null, dismissedAt: null } }),
  ]);
  const labels = { unread: t("unread"), all: t("all"), dismissed: t("dismissedTab") };
  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("intervalsInfo", { intervals: settings.notifyIntervals.join("/"), every: settings.notifyOverdueEveryDays })}
        actions={<NotificationsToolbar isAdmin={user.role === "ADMIN"} hasUnread={unread > 0} />}
      />
      <div className="mb-4 inline-flex rounded-lg border p-0.5" role="tablist">
        {FILTERS.map((f) => (
          <Button key={f} asChild size="sm" variant={filter === f ? "secondary" : "ghost"}>
            <Link href={`/notifications?filter=${f}`} role="tab" aria-selected={filter === f}>
              {labels[f]}
              {f === "unread" && unread > 0 ? ` (${unread})` : ""}
            </Link>
          </Button>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState icon={BellOff} title={t("empty")} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((n) => (
            <NotificationItem key={n.id} n={n} canEmail={can(user.role, "sendEmail")} />
          ))}
        </div>
      )}
    </>
  );
}
