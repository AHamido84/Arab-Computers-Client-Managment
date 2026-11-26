"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge, STATUS_COLOR } from "@/components/shared/status-badge";
import { useFmt } from "@/components/shared/format-provider";
import { QUOTATION_STATUSES } from "@/lib/validation/quotation";
import type { QuotationRow } from "@/server/services/quotations";

export function QuotationsTable({ rows, clients }: { rows: QuotationRow[]; clients: { id: string; nameAr: string; nameEn: string }[] }) {
  const t = useTranslations();
  const f = useFmt();
  const columns = useMemo<ColumnDef<QuotationRow, unknown>[]>(
    () => [
      {
        id: "number",
        accessorFn: (r) => `${r.number} v${r.version}`,
        header: t("quotations.number"),
        meta: { label: t("quotations.number") },
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-2">
            <Link href={`/quotations/${row.original.id}`} className="font-medium hover:underline" dir="ltr">
              {row.original.number} <span className="text-muted-foreground">v{row.original.version}</span>
            </Link>
            {!row.original.isLatest && <span className="text-xs text-muted-foreground">·</span>}
          </span>
        ),
      },
      {
        id: "client",
        accessorFn: (r) => r.client.id,
        header: t("quotations.client"),
        sortingFn: (a, b) => f.name(a.original.client).localeCompare(f.name(b.original.client)),
        meta: { label: t("quotations.client"), exportValue: (r) => f.name(r.client) },
        cell: ({ row }) => (
          <Link className="hover:underline" href={`/clients/${row.original.client.id}`}>
            {f.name(row.original.client)}
          </Link>
        ),
      },
      {
        accessorKey: "title",
        header: t("quotations.quotationTitle"),
        meta: { label: t("quotations.quotationTitle") },
        cell: ({ row }) => <span className="block max-w-72 truncate" dir="auto">{row.original.title ?? "—"}</span>,
      },
      {
        accessorKey: "status",
        header: t("quotations.status"),
        meta: { label: t("quotations.status"), exportValue: (r) => t(`quotationStatus.${r.status}`) },
        cell: ({ row }) => (
          <span className="flex flex-wrap gap-1">
            <StatusBadge color={STATUS_COLOR[row.original.status]}>{t(`quotationStatus.${row.original.status}`)}</StatusBadge>
            {row.original.expired && <StatusBadge color="orange">{t("quotations.expired")}</StatusBadge>}
          </span>
        ),
      },
      {
        accessorKey: "issueDate",
        header: t("quotations.issueDate"),
        meta: { label: t("quotations.issueDate"), exportValue: (r) => r.issueDate.slice(0, 10) },
        cell: ({ row }) => f.date(row.original.issueDate),
      },
      {
        accessorKey: "validUntil",
        header: t("quotations.validUntil"),
        meta: { label: t("quotations.validUntil"), exportValue: (r) => r.validUntil.slice(0, 10) },
        cell: ({ row }) => <span className={row.original.expired ? "text-orange-700 dark:text-orange-300" : ""}>{f.date(row.original.validUntil)}</span>,
      },
      {
        accessorKey: "total",
        header: t("common.total"),
        meta: { label: t("common.total"), align: "end" },
        cell: ({ row }) => f.money(row.original.total, row.original.currency),
      },
      {
        id: "latest",
        accessorFn: (r) => (r.isLatest ? "latest" : "old"),
        header: t("quotations.version"),
        meta: { label: t("quotations.version"), exportValue: (r) => r.version },
        cell: ({ row }) => (row.original.isLatest ? <StatusBadge color="sky">{t("quotations.latest")}</StatusBadge> : <span className="text-muted-foreground">v{row.original.version}</span>),
      },
    ],
    [t, f],
  );
  return (
    <DataTable
      data={rows}
      columns={columns}
      exportName="quotations"
      rowHref={(r) => `/quotations/${r.id}`}
      rowClassName={(r) => (r.isLatest ? undefined : "bg-muted/40")}
      searchText={(r) => [r.number, r.title, r.client.nameAr, r.client.nameEn].join(" ")}
      filters={[
        { columnId: "status", label: t("quotations.status"), options: QUOTATION_STATUSES.map((s) => ({ value: s, label: t(`quotationStatus.${s}`) })) },
        { columnId: "client", label: t("quotations.client"), options: clients.map((c) => ({ value: c.id, label: f.name(c) })) },
        { columnId: "latest", label: t("quotations.version"), options: [{ value: "latest", label: t("quotations.latest") }] },
      ]}
    />
  );
}
