"use client";

/**
 * Gantt-style timeline for one project: a bar per task from its start to its
 * due date, today line, original-due-date marker, Fri/Sat shaded. Uses logical
 * (inline-start) positioning so it mirrors automatically in RTL.
 */
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Diamond } from "lucide-react";
import { useFmt } from "@/components/shared/format-provider";
import { intlLocale } from "@/lib/format";
import { addDays, isWorkingDay, iso, utcDay } from "@/lib/delivery-views";
import type { TaskRow } from "@/server/services/delivery";
import { cn } from "@/lib/utils";

const W = 28; // px per day
const DAY = 86_400_000;

const BAR: Record<string, string> = {
  NOT_STARTED: "bg-slate-400/70 dark:bg-slate-500",
  IN_PROGRESS: "bg-amber-500",
  IN_REVIEW: "bg-violet-500",
  DELIVERED: "bg-emerald-600",
  CLIENT_ACCEPTED: "bg-blue-600",
  ON_HOLD: "bg-orange-400",
};

export function ProjectTimeline({ rows, today, projectStart, projectTarget }: { rows: TaskRow[]; today: string; projectStart?: string | null; projectTarget?: string | null }) {
  const t = useTranslations();
  const f = useFmt();
  const dated = rows.filter((r) => r.dueDate);
  if (!dated.length) return <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">{t("views.noDates")}</p>;

  const now = utcDay(today);
  const pts = dated.flatMap((r) => [r.startDate, r.dueDate, r.originalDueDate]).concat(projectStart ?? null, projectTarget ?? null).filter(Boolean).map((d) => utcDay(d!).getTime());
  pts.push(now.getTime());
  const start = addDays(new Date(Math.min(...pts)), -2);
  const end = addDays(new Date(Math.max(...pts)), 3);
  const n = Math.round((end.getTime() - start.getTime()) / DAY) + 1;
  const days = Array.from({ length: n }, (_, i) => addDays(start, i));
  const x = (d: string | Date) => Math.round((utcDay(d).getTime() - start.getTime()) / DAY);
  const loc = intlLocale(f.locale);
  const dayFmt = new Intl.DateTimeFormat(loc, { day: "numeric", timeZone: "UTC" });
  const monFmt = new Intl.DateTimeFormat(loc, { month: "short", year: "numeric", timeZone: "UTC" });
  const months = days.reduce<{ label: string; from: number; len: number }[]>((acc, d, i) => {
    const label = monFmt.format(d);
    if (acc.length && acc[acc.length - 1].label === label) acc[acc.length - 1].len++;
    else acc.push({ label, from: i, len: 1 });
    return acc;
  }, []);
  const width = n * W;
  const todayX = x(now);

  const shading = (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {days.map((d, i) =>
        isWorkingDay(d) ? null : <div key={i} className="absolute inset-y-0 bg-muted/60" style={{ insetInlineStart: i * W, width: W }} />,
      )}
      <div className="absolute inset-y-0 w-0.5 bg-primary/70" style={{ insetInlineStart: todayX * W + W / 2 }} />
      {projectTarget && <div className="absolute inset-y-0 border-s-2 border-dashed border-foreground/30" style={{ insetInlineStart: (x(projectTarget) + 1) * W }} />}
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-0.5 bg-primary/70" aria-hidden /> {t("views.today")}</span>
        <span className="inline-flex items-center gap-1"><Diamond className="size-3 fill-current" aria-hidden /> {t("views.original")}</span>
        {projectTarget && <span className="inline-flex items-center gap-1"><span className="inline-block h-3 border-s-2 border-dashed border-foreground/30" aria-hidden /> {t("delivery.targetDate")}</span>}
      </div>
      <div className="overflow-x-auto rounded-xl border" tabIndex={0} role="region" aria-label={t("views.timeline")}>
        <div className="grid" style={{ gridTemplateColumns: `minmax(12rem, 16rem) ${width}px` }}>
          {/* header */}
          <div className="sticky start-0 z-20 row-span-2 border-b border-e bg-background" />
          <div className="relative h-6 border-b" style={{ width }}>
            {months.map((m) => (
              <div key={m.from} className="absolute inset-y-0 truncate border-s px-1 text-xs leading-6 font-medium" style={{ insetInlineStart: m.from * W, width: m.len * W }}>
                {m.label}
              </div>
            ))}
          </div>
          <div className="relative h-6 border-b" style={{ width }}>
            {days.map((d, i) => (
              <div
                key={i}
                className={cn("num absolute inset-y-0 text-center text-[10px] leading-6 text-muted-foreground", !isWorkingDay(d) && "bg-muted/60", i === todayX && "font-bold text-primary")}
                style={{ insetInlineStart: i * W, width: W }}
              >
                {dayFmt.format(d)}
              </div>
            ))}
          </div>

          {dated.map((r) => {
            const due = x(r.dueDate!);
            // No task start → assume it starts with the project.
            const startIso = r.startDate ?? projectStart ?? null;
            const s = startIso ? Math.min(x(startIso), due) : due;
            const orig = r.originalDueDate && iso(utcDay(r.originalDueDate)) !== iso(utcDay(r.dueDate!)) ? x(r.originalDueDate) : null;
            const label = t("views.barLabel", {
              title: r.title,
              start: f.date(startIso ?? r.dueDate),
              due: f.date(r.dueDate),
              status: t(`taskStatus.${r.status}`),
            }) + ` · ${r.progress}%`;
            return (
              <div key={r.id} className="contents">
                <div className="sticky start-0 z-10 flex min-w-0 items-center border-b border-e bg-background px-3 py-1.5 text-sm">
                  <Link href={`/tasks/${r.id}`} dir="auto" className={cn("truncate hover:underline", r.overdue && "text-destructive")} title={r.title}>
                    {r.title}
                  </Link>
                </div>
                <div className="relative h-10 border-b" style={{ width }}>
                  {shading}
                  <Link
                    href={`/tasks/${r.id}`}
                    aria-label={label}
                    title={label}
                    className={cn(
                      "absolute top-2 h-6 overflow-hidden rounded-md text-[10px] leading-6 text-white shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                      BAR[r.status],
                      r.overdue && "ring-2 ring-destructive",
                    )}
                    style={{ insetInlineStart: s * W + 2, width: (due - s + 1) * W - 4 }}
                  >
                    <span className="absolute inset-y-0 start-0 bg-black/20" style={{ width: `${r.progress}%` }} aria-hidden />
                    <span className="num relative px-1.5 font-medium">{r.progress}%</span>
                  </Link>
                  {orig != null && (
                    <Diamond
                      className="absolute top-3 size-4 fill-foreground/70 text-foreground/70"
                      style={{ insetInlineStart: orig * W + W / 2 - 8 }}
                      aria-hidden
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {rows.length > dated.length && <p className="text-xs text-muted-foreground">{t("views.noDue", { count: rows.length - dated.length })}</p>}
    </div>
  );
}
