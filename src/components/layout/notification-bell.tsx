import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Header bell with unread count. The dropdown list arrives in Phase 5. */
export async function NotificationBell({ unread }: { unread: number }) {
  const t = await getTranslations("nav");
  return (
    <Button variant="ghost" size="icon" asChild className="relative" aria-label={t("notifications")}>
      <Link href="/notifications">
        <Bell />
        {unread > 0 && (
          <span className="absolute -top-0.5 -end-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    </Button>
  );
}
