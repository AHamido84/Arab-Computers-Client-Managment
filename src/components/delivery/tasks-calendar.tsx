"use client";

/** Month calendar of task due dates (Saturday-first, Fri/Sat shaded as weekend). */
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFmt } from "@/components/shared/format-provider";
import { intlLocale } from "@/lib/format";
import { iso, isWorkingDay, monthGrid, utcDay } from "@/lib/delivery-views";
import { isDone } from "@/lib/delivery";
import type { TaskRow } from "@/server/services/delivery";
import { cn } from "@/lib/utils";

const MAX_CHIPS = 3;

function chipClass(r: TaskRow) {
  if (r.overdue) return "border-destructive/40 bg-destructive/10 text-destructive";
  if (isDone(r.status)) return "border-emerald-600/30 bg-emerald-500/10 text-emerald-800 line-through decoration-emerald-700/40 dark:text-emerald-300";
  if (r.status === "IN_PROGRESS" || r.status === "IN_REVIEW") return "border-amber-600/30 bg-amber-500/10 text-amber-900 dark:text-amber-200";
  if (r.status === "ON_HOLD") return "border-orange-600/30 bg-orange-500/10 text-orange-900 dark:text-orange-200";
  return "border-border bg-card text-foreground";
}

export function TasksCalendar({ rows, today }: { rows: TaskRow[]; today: string }) {
  const t = useTranslations("views");
  const f = useFmt();
  const now = utcDay(today);
  const [cursor, setCursor] = useState({ y: now.getUTCFullYear(), m: now.getUTCMonth() });
  const days = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);
  const byDay = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const r of rows) if (r.dueDate) map.set(r.dueDate.slice(0, 10), [...(map.get(r.dueDate.slice(0, 10)) ?? []), r]);
    return map;
  }, [rows]);
  const noDue = rows.filter((r) => !r.dueDate).length;
  const loc = intlLocale(f.locale);
  const monthLabel = new Intl.DateTimeFormat(loc, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(cursor.y, cursor.m, 1)));
  const wd = new Intl.DateTimeFormat(loc, { weekday: "short", timeZone: "UTC" });
  const dayNum = new Intl.DateTimeFormat(loc, { day: "numeric", timeZone: "UTC" });
  const shift = (n: number) => setCursor(({ y, m }) => ({ y: y + Math.floor((m + n) / 12), m: (((m + n) % 12) + 12) % 12 }));
  const todayIso = iso(now);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => shift(-1)} aria-label={t("prevMonth")}>
          <ChevronRight className="ltr:rotate-180" />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => shift(1)} aria-label={t("nextMonth")}>
          <ChevronLeft className="ltr:rotate-180" />
        </Button>
        <h2 className="min-w-40 text-base font-semibold" aria-live="polite">{monthLabel}</h2>
        <Button variant="ghost" size="sm" onClick={() => setCursor({ y: now.getUTCFullYear(), m: now.getUTCMonth() })}>
          {t("today")}
        </Button>
        {noDue > 0 && <p className="text-xs text-muted-foreground sm:ms-auto">{t("noDue", { count: noDue })}</p>}
      </div>

      <div className="overflow-x-auto rounded-xl border" tabIndex={0} role="region" aria-label={monthLabel}>
        <div className="grid min-w-[44rem] grid-cols-7">
          {days.slice(0, 7).map((d) => (
            <div key={d.getUTCDay()} className={cn("border-b px-2 py-1.5 text-center text-xs font-medium text-muted-foreground", !isWorkingDay(d) && "bg-muted/60")}>
              {wd.format(d)}
            </div>
          ))}
          {days.map((d) => {
            const key = iso(d);
            const list = byDay.get(key) ?? [];
            const out = d.getUTCMonth() !== cursor.m;
            return (
              <div
                key={key}
                className={cn(
                  "min-h-28 border-b border-e p-1.5 [&:nth-child(7n)]:border-e-0",
                  !isWorkingDay(d) && "bg-muted/50",
                  out && "text-muted-foreground",
                )}
              >
                <div className="mb-1 flex justify-end">
                  <span
                    className={cn("num grid size-6 place-items-center rounded-full text-xs", key === todayIso && "bg-primary font-semibold text-primary-foreground")}
                    aria-current={key === todayIso ? "date" : undefined}
                  >
                    {dayNum.format(d)}
                  </span>
                </div>
                <ul className="space-y-1">
                  {list.slice(0, MAX_CHIPS).map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/tasks/${r.id}`}
                        dir="auto"
                        title={`${r.title} · ${r.project.number}`}
                        className={cn("block truncate rounded border px-1.5 py-0.5 text-xs hover:underline", chipClass(r))}
                      >
                        {r.title}
                      </Link>
                    </li>
                  ))}
                  {list.length > MAX_CHIPS && (
                    <li className="px-1 text-xs text-muted-foreground" title={list.slice(MAX_CHIPS).map((r) => r.title).join("\n")}>
                      {t("more", { count: list.length - MAX_CHIPS })}
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
