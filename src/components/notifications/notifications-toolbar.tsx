"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCheck, Loader2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerAction } from "@/components/forms/use-action";
import { markAllReadAction, runDailyJobAction } from "@/server/actions/notifications";

export function NotificationsToolbar({ isAdmin, hasUnread }: { isAdmin: boolean; hasUnread: boolean }) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const all = useServerAction();
  const job = useServerAction();
  return (
    <>
      {hasUnread && (
        <Button variant="outline" disabled={all.pending} onClick={() => all.run(() => markAllReadAction(), { onSuccess: () => router.refresh() })}>
          <CheckCheck /> {t("markAllRead")}
        </Button>
      )}
      {isAdmin && (
        <Button
          variant="outline"
          disabled={job.pending}
          onClick={() =>
            job.run(() => runDailyJobAction(), {
              onSuccess: (r) => {
                toast.success(t("runResult", { created: r.notificationsCreated, overdue: r.amcMarkedOverdue }));
                router.refresh();
              },
            })
          }
        >
          {job.pending ? <Loader2 className="animate-spin" /> : <PlayCircle />} {t("runNow")}
        </Button>
      )}
    </>
  );
}
