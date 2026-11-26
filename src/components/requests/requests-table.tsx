"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge, STATUS_COLOR } from "@/components/shared/status-badge";
import { useFmt } from "@/components/shared/format-provider";
import { PRIORITIES, REQUEST_STATUSES } from "@/lib/validation/request";
import type { RequestRow } from "@/server/services/requests";

const PRIORITY_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 } as const;

export function RequestsTable({ rows, users, clients }: { rows: RequestRow[]; users: { id: string; name: string }[]; clients: { id: string; nameAr: string; nameEn: string }[] }) {
  const t = useTranslations();
  const f = useFmt();
  const columns = useMemo<ColumnDef<RequestRow, unknown>[]>(
    () => [
      {
        accessorKey: "number",
        header: t("requests.number"),
        meta: { label: t("requests.number") },
        cell: ({ row }) => (
          <Link href={`/requests/${row.original.id}`} className="font-medium hover:underline" dir="ltr">
            {row.original.number}
          </Link>
        ),
      },
      {
        accessorKey: "title",
        header: t("requests.requestTitle"),
        meta: { label: t("requests.requestTitle") },
        cell: ({ row }) => (
          <div className="max-w-80 min-w-48 whitespace-normal">
            <div className="font-medium">{row.original.title}</div>
            {row.original.type && <div className="text-xs text-muted-foreground">{f.name(row.original.type)}</div>}
          </div>
        ),
      },
      {
        id: "client",
        accessorFn: (r) => r.client.id,
        header: t("requests.client"),
        sortingFn: (a, b) => f.name(a.original.client).localeCompare(f.name(b.original.client)),
        meta: { label: t("requests.client"), exportValue: (r) => f.name(r.client) },
        cell: ({ row }) => (
          <Link href={`/clients/${row.original.client.id}`} className="hover:underline">
            {f.name(row.original.client)}
          </Link>
        ),
      },
      {
        accessorKey: "status",
        header: t("requests.status"),
        sortingFn: (a, b) => REQUEST_STATUSES.indexOf(a.original.status) - REQUEST_STATUSES.indexOf(b.original.status),
        meta: { label: t("requests.status"), exportValue: (r) => t(`requestStatus.${r.status}`) },
        cell: ({ row }) => <StatusBadge color={STATUS_COLOR[row.original.status]}>{t(`requestStatus.${row.original.status}`)}</StatusBadge>,
      },
      {
        accessorKey: "priority",
        header: t("requests.priority"),
        sortingFn: (a, b) => PRIORITY_RANK[a.original.priority] - PRIORITY_RANK[b.original.priority],
        meta: { label: t("requests.priority"), exportValue: (r) => t(`priority.${r.priority}`) },
        cell: ({ row }) => <StatusBadge color={STATUS_COLOR[row.original.priority]}>{t(`priority.${row.original.priority}`)}</StatusBadge>,
      },
      {
        id: "assignee",
        accessorFn: (r) => r.assignee?.id ?? "",
        header: t("requests.assignee"),
        meta: { label: t("requests.assignee"), exportValue: (r) => r.assignee?.name ?? "" },
        cell: ({ row }) => row.original.assignee?.name ?? <span className="text-muted-foreground">{t("requests.unassigned")}</span>,
      },
      {
        accessorKey: "requestDate",
        header: t("requests.requestDate"),
        meta: { label: t("requests.requestDate"), exportValue: (r) => r.requestDate.slice(0, 10) },
        cell: ({ row }) => f.date(row.original.requestDate),
      },
      {
        id: "dueDate",
        accessorFn: (r) => r.dueDate ?? "9999",
        header: t("requests.dueDate"),
        meta: { label: t("requests.dueDate"), exportValue: (r) => r.dueDate?.slice(0, 10) ?? "" },
        cell: ({ row }) =>
          row.original.overdue ? (
            <span className="inline-flex items-center gap-1 font-medium text-destructive">
              <AlertTriangle className="size-3.5" /> {f.date(row.original.dueDate)}
            </span>
          ) : (
            f.date(row.original.dueDate)
          ),
      },
      {
        accessorKey: "total",
        header: t("common.total"),
        meta: { label: t("common.total"), align: "end" },
        cell: ({ row }) => (row.original.total ? f.money(row.original.total, row.original.currency) : "—"),
      },
    ],
    [t, f],
  );
  return (
    <DataTable
      data={rows}
      columns={columns}
      exportName="requests"
      rowHref={(r) => `/requests/${r.id}`}
      rowClassName={(r) => (r.overdue ? "bg-destructive/5 hover:bg-destructive/10" : undefined)}
      searchText={(r) => [r.number, r.title, r.client.nameAr, r.client.nameEn, r.assignee?.name, r.contract?.number].join(" ")}
      filters={[
        { columnId: "status", label: t("requests.status"), options: REQUEST_STATUSES.map((s) => ({ value: s, label: t(`requestStatus.${s}`) })) },
        { columnId: "priority", label: t("requests.priority"), options: PRIORITIES.map((s) => ({ value: s, label: t(`priority.${s}`) })) },
        { columnId: "assignee", label: t("requests.assignee"), options: users.map((u) => ({ value: u.id, label: u.name })) },
        { columnId: "client", label: t("requests.client"), options: clients.map((c) => ({ value: c.id, label: f.name(c) })) },
      ]}
    />
  );
}
