"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDays, Columns3, GanttChart, Table2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ICONS = { table: Table2, kanban: Columns3, calendar: CalendarDays, workload: Users, timeline: GanttChart } as const;
export type ViewKey = keyof typeof ICONS;

/** Segmented links that switch ?view= while keeping the current filters. */
export function ViewSwitcher({ views, current }: { views: ViewKey[]; current: ViewKey }) {
  const t = useTranslations("views");
  const pathname = usePathname();
  const sp = useSearchParams();
  const href = (v: ViewKey) => {
    const q = new URLSearchParams(sp.toString());
    if (v === views[0]) q.delete("view");
    else q.set("view", v);
    const s = q.toString();
    return s ? `${pathname}?${s}` : pathname;
  };
  return (
    <nav aria-label={t("views")} className="inline-flex flex-wrap rounded-lg border p-0.5">
      {views.map((v) => {
        const Icon = ICONS[v];
        const on = v === current;
        return (
          <Button key={v} asChild size="sm" variant={on ? "secondary" : "ghost"} className={cn(!on && "text-muted-foreground")}>
            <Link href={href(v)} aria-current={on ? "page" : undefined} scroll={false}>
              <Icon /> {t(v)}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
