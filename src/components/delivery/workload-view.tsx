"use client";

/** People × weeks grid of remaining estimated hours, highlighted against weekly capacity. */
import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useFmt } from "@/components/shared/format-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { computeWorkload, loadLevel } from "@/lib/delivery-views";
import type { TaskRow } from "@/server/services/delivery";
import { cn } from "@/lib/utils";

const LEVEL_CLASS = {
  none: "text-muted-foreground",
  ok: "bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
  high: "bg-amber-500/20 text-amber-950 dark:text-amber-200",
  over: "bg-destructive/15 font-semibold text-destructive",
} as const;

export function WorkloadView({ rows, people, today, capacity }: { rows: TaskRow[]; people: { id: string; name: string }[]; today: string; capacity: number }) {
  const t = useTranslations("views");
  const f = useFmt();
  const { weekStarts, byUser, unscheduled } = useMemo(() => computeWorkload(rows, new Date(today)), [rows, today]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const names = new Map(people.map((p) => [p.id, p.name]));
  for (const r of rows) for (const a of r.assignees) if (!names.has(a.userId)) names.set(a.userId, a.name);
  const userIds = [...new Set([...byUser.keys(), ...unscheduled.keys()])].sort((a, b) => (names.get(a) ?? "").localeCompare(names.get(b) ?? ""));

  if (!userIds.length) return <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">{t("noPeople")}</p>;

  const taskList = (ids: string[]) => (
    <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
      {ids.map((id) => {
        const r = byId.get(id);
        return r ? (
          <li key={id}>
            <Link href={`/tasks/${id}`} dir="auto" className={cn("hover:underline", r.overdue && "text-destructive")}>
              {r.title}
            </Link>
            <span className="block text-xs text-muted-foreground">
              <span dir="ltr">{r.project.number}</span> · {r.dueDate ? f.date(r.dueDate) : "—"}
            </span>
          </li>
        ) : null;
      })}
    </ul>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{t("capacity", { hours: f.number(capacity) })}</span>
        {(["ok", "high", "over"] as const).map((l) => (
          <span key={l} className="inline-flex items-center gap-1">
            <span className={cn("inline-block size-3 rounded-sm ring-1 ring-border", LEVEL_CLASS[l])} aria-hidden /> {t(l === "ok" ? "loadOk" : l === "high" ? "loadHigh" : "loadOver")}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border" tabIndex={0} role="region" aria-label={t("workload")}>
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th scope="col" className="sticky start-0 z-10 bg-muted px-3 py-2 text-start font-medium">{t("person")}</th>
              {weekStarts.map((w) => (
                <th key={w} scope="col" className="px-2 py-2 text-center text-xs font-medium whitespace-nowrap">{t("weekOf", { date: f.date(w) })}</th>
              ))}
              <th scope="col" className="px-2 py-2 text-center text-xs font-medium">{t("unscheduled")}</th>
            </tr>
          </thead>
          <tbody>
            {userIds.map((u) => {
              const cells = byUser.get(u) ?? weekStarts.map(() => ({ hours: 0, taskIds: [] as string[] }));
              const un = unscheduled.get(u) ?? [];
              return (
                <tr key={u} className="border-b last:border-0">
                  <th scope="row" className="sticky start-0 z-10 bg-background px-3 py-2 text-start font-medium whitespace-nowrap">{names.get(u) ?? "—"}</th>
                  {cells.map((c, i) => {
                    const level = loadLevel(c.hours, capacity);
                    return (
                      <td key={i} className="p-1 text-center">
                        {c.taskIds.length ? (
                          <Popover>
                            <PopoverTrigger
                              className={cn("num w-full rounded-md px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring", LEVEL_CLASS[level])}
                              aria-label={`${names.get(u)} · ${t("weekOf", { date: f.date(weekStarts[i]) })}: ${t("hoursShort", { hours: f.number(c.hours, 1) })}, ${t("tasksInCell", { count: c.taskIds.length })}`}
                            >
                              {t("hoursShort", { hours: f.number(c.hours, 1) })}
                              <span className="block text-[10px] opacity-80">{t("tasksInCell", { count: c.taskIds.length })}</span>
                            </PopoverTrigger>
                            <PopoverContent className="w-72">{taskList(c.taskIds)}</PopoverContent>
                          </Popover>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-1 text-center">
                    {un.length ? (
                      <Popover>
                        <PopoverTrigger className="w-full rounded-md px-2 py-1.5 text-xs text-muted-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                          {t("tasksInCell", { count: un.length })}
                        </PopoverTrigger>
                        <PopoverContent className="w-72">{taskList(un)}</PopoverContent>
                      </Popover>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{t("workloadHint")}</p>
    </div>
  );
}
