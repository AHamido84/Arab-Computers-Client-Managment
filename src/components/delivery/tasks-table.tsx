"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Crown } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge, STATUS_COLOR } from "@/components/shared/status-badge";
import { useFmt } from "@/components/shared/format-provider";
import { ProgressBar } from "./progress-bar";
import { TASK_STATUSES } from "@/lib/delivery";
import type { TaskRow } from "@/server/services/delivery";

export const TASK_STATUS_COLOR: Record<string, string> = {
  NOT_STARTED: "slate", IN_PROGRESS: "amber", IN_REVIEW: "violet", DELIVERED: "green", CLIENT_ACCEPTED: "blue", ON_HOLD: "orange",
};

/** "overdue" | "week" | "later" | "none" — used by the Due filter. */
export function dueBucket(r: Pick<TaskRow, "dueDate" | "overdue" | "status">, today: Date) {
  if (r.overdue) return "overdue";
  if (!r.dueDate || ["DELIVERED", "CLIENT_ACCEPTED"].includes(r.status)) return "none";
  const end = new Date(today.getTime() + 7 * 86_400_000);
  return new Date(r.dueDate) < end ? "week" : "later";
}

export function TasksTable({
  rows,
  showProject = true,
  showPrice = false,
  people,
  today,
  withFilters = true,
}: {
  withFilters?: boolean;
  rows: TaskRow[];
  showProject?: boolean;
  showPrice?: boolean;
  people: { id: string; name: string }[];
  today: string;
}) {
  const t = useTranslations();
  const f = useFmt();
  const now = useMemo(() => new Date(today), [today]);
  const columns = useMemo<ColumnDef<TaskRow, unknown>[]>(() => {
    const cols: ColumnDef<TaskRow, unknown>[] = [
      {
        accessorKey: "title",
        header: t("tasks.taskTitle"),
        meta: { label: t("tasks.taskTitle") },
        cell: ({ row }) => (
          <div className="max-w-80 min-w-48 whitespace-normal">
            <Link href={`/tasks/${row.original.id}`} className="font-medium hover:underline" dir="auto">
              {row.original.title}
            </Link>
            {row.original.checklist.total > 0 && (
              <div className="text-xs text-muted-foreground">
                ✓ {row.original.checklist.done}/{row.original.checklist.total}
              </div>
            )}
          </div>
        ),
      },
    ];
    if (showProject)
      cols.push(
        {
          id: "project",
          accessorFn: (r) => r.project.id,
          header: t("tasks.project"),
          sortingFn: (a, b) => a.original.project.number.localeCompare(b.original.project.number),
          meta: { label: t("tasks.project"), exportValue: (r) => `${r.project.number} ${r.project.title}` },
          cell: ({ row }) => (
            <Link href={`/delivery/${row.original.project.id}`} className="text-sm hover:underline">
              <span dir="ltr" className="text-muted-foreground">{row.original.project.number}</span>
              <span className="block max-w-56 truncate" dir="auto">{row.original.project.title}</span>
            </Link>
          ),
        },
        {
          id: "client",
          accessorFn: (r) => r.project.client.id,
          header: t("tasks.client"),
          sortingFn: (a, b) => f.name(a.original.project.client).localeCompare(f.name(b.original.project.client)),
          meta: { label: t("tasks.client"), exportValue: (r) => f.name(r.project.client) },
          cell: ({ row }) => <span className="text-sm">{f.name(row.original.project.client)}</span>,
        },
      );
    cols.push(
      {
        accessorKey: "status",
        header: t("tasks.status"),
        sortingFn: (a, b) => TASK_STATUSES.indexOf(a.original.status) - TASK_STATUSES.indexOf(b.original.status),
        meta: { label: t("tasks.status"), exportValue: (r) => t(`taskStatus.${r.status}`) },
        cell: ({ row }) => <StatusBadge color={TASK_STATUS_COLOR[row.original.status]}>{t(`taskStatus.${row.original.status}`)}</StatusBadge>,
      },
      {
        accessorKey: "priority",
        header: t("tasks.priority"),
        meta: { label: t("tasks.priority"), exportValue: (r) => t(`priority.${r.priority}`) },
        cell: ({ row }) => <StatusBadge color={STATUS_COLOR[row.original.priority]}>{t(`priority.${row.original.priority}`)}</StatusBadge>,
      },
      {
        id: "assignee",
        accessorFn: (r) => r.assignees.map((a) => a.userId),
        header: t("tasks.assignees"),
        enableSorting: false,
        meta: { label: t("tasks.assignees"), exportValue: (r) => r.assignees.map((a) => `${a.name}${a.role === "LEAD" ? " (Lead)" : ""}`).join(", ") },
        cell: ({ row }) =>
          row.original.assignees.length ? (
            <div className="flex max-w-48 flex-wrap gap-1 text-xs">
              {row.original.assignees.map((a) => (
                <span key={a.userId} className="inline-flex items-center gap-0.5">
                  {a.role === "LEAD" && <Crown className="size-3 text-primary" aria-label={t("assigneeRole.LEAD")} />}
                  {a.name}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{t("tasks.unassigned")}</span>
          ),
      },
      {
        id: "due",
        accessorFn: (r) => [dueBucket(r, now)],
        header: t("tasks.dueDate"),
        sortingFn: (a, b) => (a.original.dueDate ?? "9").localeCompare(b.original.dueDate ?? "9"),
        meta: { label: t("tasks.dueDate"), exportValue: (r) => r.dueDate?.slice(0, 10) ?? "" },
        cell: ({ row }) =>
          row.original.dueDate ? (
            <span className={row.original.overdue ? "inline-flex items-center gap-1 font-medium text-destructive" : ""}>
              {row.original.overdue && <AlertTriangle className="size-3.5" />}
              {f.date(row.original.dueDate)}
            </span>
          ) : (
            "—"
          ),
      },
      {
        accessorKey: "progress",
        header: t("tasks.progress"),
        meta: { label: t("tasks.progress"), exportValue: (r) => r.progress },
        cell: ({ row }) => <ProgressBar value={row.original.progress} label={t("tasks.progress")} className="w-32" tone={row.original.overdue ? "danger" : row.original.progress === 100 ? "success" : "default"} />,
      },
      {
        id: "hours",
        accessorFn: (r) => r.loggedHours,
        header: t("tasks.loggedHours"),
        meta: { label: t("tasks.loggedHours"), align: "end", exportValue: (r) => r.loggedHours },
        cell: ({ row }) => (
          <span className={row.original.estimatedHours != null && row.original.loggedHours > row.original.estimatedHours ? "font-medium text-destructive" : ""}>
            {f.number(row.original.loggedHours, 0)}
            {row.original.estimatedHours != null && <span className="text-muted-foreground"> / {f.number(row.original.estimatedHours, 0)}</span>}
          </span>
        ),
      },
    );
    if (showPrice)
      cols.push({
        accessorKey: "price",
        header: t("tasks.price"),
        meta: { label: t("tasks.price"), align: "end" },
        cell: ({ row }) => (row.original.price != null ? f.money(row.original.price, row.original.currency) : "—"),
      });
    return cols;
  }, [t, f, showProject, showPrice, now]);

  const projects = [...new Map(rows.map((r) => [r.project.id, r.project])).values()];
  const clients = [...new Map(rows.map((r) => [r.project.client.id, r.project.client])).values()];
  return (
    <DataTable
      data={rows}
      columns={columns}
      exportName="tasks"
      rowHref={(r) => `/tasks/${r.id}`}
      rowClassName={(r) => (r.overdue ? "bg-destructive/5 hover:bg-destructive/10" : undefined)}
      searchText={(r) => [r.title, r.project.number, r.project.title, r.project.client.nameAr, r.project.client.nameEn, ...r.assignees.map((a) => a.name)].join(" ")}
      filters={withFilters ? [
        { columnId: "due", label: t("tasks.dueDate"), options: [{ value: "overdue", label: t("tasks.overdue") }, { value: "week", label: t("tasks.dueThisWeek") }, { value: "later", label: t("tasks.later") }] },
        { columnId: "status", label: t("tasks.status"), options: TASK_STATUSES.map((s) => ({ value: s, label: t(`taskStatus.${s}`) })) },
        { columnId: "assignee", label: t("tasks.assignees"), options: people.map((p) => ({ value: p.id, label: p.name })) },
        ...(showProject
          ? [
              { columnId: "client", label: t("tasks.client"), options: clients.map((c) => ({ value: c.id, label: f.name(c) })) },
              { columnId: "project", label: t("tasks.project"), options: projects.map((p) => ({ value: p.id, label: `${p.number} · ${p.title}` })) },
            ]
          : []),
      ] : []}
    />
  );
}
