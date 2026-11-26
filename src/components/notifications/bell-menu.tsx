"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NotificationItem } from "./notification-item";
import type { NotificationView } from "@/server/services/notifications";

export function BellMenu({ unread, items, canEmail }: { unread: number; items: NotificationView[]; canEmail: boolean }) {
  const t = useTranslations("notifications");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`${t("bellTitle")}${unread ? ` ${unread > 99 ? "99+" : unread}` : ""}`}>
          <Bell />
          {unread > 0 && (
            <span className="absolute -end-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="font-medium">{t("bellTitle")}</span>
          <span className="text-xs text-muted-foreground">{unread}</span>
        </div>
        <div className="max-h-96 space-y-1 overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            items.map((n) => <NotificationItem key={n.id} n={n} compact canEmail={canEmail} />)
          )}
        </div>
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/notifications">{t("viewAll")}</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
