"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { useFmt } from "@/components/shared/format-provider";
import { ProgressBar } from "./progress-bar";
import type { ProjectRow } from "@/server/services/delivery";

export const PROJECT_STATUS_COLOR: Record<string, string> = { ACTIVE: "amber", ON_HOLD: "orange", DELIVERED: "green", CLIENT_ACCEPTED: "blue", CANCELLED: "slate" };
const STATUSES = ["ACTIVE", "ON_HOLD", "DELIVERED", "CLIENT_ACCEPTED", "CANCELLED"] as const;

export function ProjectsTable({ rows }: { rows: ProjectRow[] }) {
  const t = useTranslations();
  const f = useFmt();
  const columns = useMemo<ColumnDef<ProjectRow, unknown>[]>(
    () => [
      {
        accessorKey: "number",
        header: t("delivery.number"),
        meta: { label: t("delivery.number") },
        cell: ({ row }) => (
          <Link href={`/delivery/${row.original.id}`} className="font-medium hover:underline" dir="ltr">
            {row.original.number}
          </Link>
        ),
      },
      {
        accessorKey: "title",
        header: t("delivery.projectTitle"),
        meta: { label: t("delivery.projectTitle") },
        cell: ({ row }) => (
          <div className="max-w-72 min-w-44 whitespace-normal">
            <div className="font-medium" dir="auto">{row.original.title}</div>
            {row.original.reference && <div className="text-xs text-muted-foreground" dir="ltr">{row.original.reference}</div>}
          </div>
        ),
      },
      {
        id: "client",
        accessorFn: (r) => r.client.id,
        header: t("delivery.client"),
        sortingFn: (a, b) => f.name(a.original.client).localeCompare(f.name(b.original.client)),
        meta: { label: t("delivery.client"), exportValue: (r) => f.name(r.client) },
        cell: ({ row }) => f.name(row.original.client),
      },
      {
        accessorKey: "status",
        header: t("delivery.status"),
        meta: { label: t("delivery.status"), exportValue: (r) => t(`projectStatus.${r.status}`) },
        cell: ({ row }) => <StatusBadge color={PROJECT_STATUS_COLOR[row.original.status]}>{t(`projectStatus.${row.original.status}`)}</StatusBadge>,
      },
      {
        accessorKey: "progress",
        header: t("delivery.progress"),
        meta: { label: t("delivery.progress"), exportValue: (r) => r.progress },
        cell: ({ row }) => (
          <div className="w-40">
            <ProgressBar value={row.original.progress} label={t("delivery.progress")} tone={row.original.late ? "danger" : row.original.progress === 100 ? "success" : "default"} />
            <div className="text-xs text-muted-foreground">{t("delivery.progressOf", { done: row.original.tasksDone, total: row.original.tasksTotal })}</div>
          </div>
        ),
      },
      {
        accessorKey: "overdue",
        header: t("delivery.overdueTasks"),
        meta: { label: t("delivery.overdueTasks"), align: "end" },
        cell: ({ row }) => (row.original.overdue ? <StatusBadge color="red">{row.original.overdue}</StatusBadge> : <span className="text-muted-foreground">0</span>),
      },
      {
        id: "target",
        accessorFn: (r) => r.targetDate ?? "9999",
        header: t("delivery.targetDate"),
        meta: { label: t("delivery.targetDate"), exportValue: (r) => r.targetDate?.slice(0, 10) ?? "" },
        cell: ({ row }) => <span className={row.original.late ? "font-medium text-destructive" : ""}>{f.date(row.original.targetDate)}</span>,
      },
    ],
    [t, f],
  );
  return (
    <DataTable
      data={rows}
      columns={columns}
      exportName="delivery-projects"
      rowHref={(r) => `/delivery/${r.id}`}
      searchText={(r) => [r.number, r.title, r.reference, r.client.nameAr, r.client.nameEn].join(" ")}
      filters={[{ columnId: "status", label: t("delivery.status"), options: STATUSES.map((s) => ({ value: s, label: t(`projectStatus.${s}`) })) }]}
    />
  );
}
