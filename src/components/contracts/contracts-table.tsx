"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge, STATUS_COLOR } from "@/components/shared/status-badge";
import { useFmt } from "@/components/shared/format-provider";
import type { ContractRow } from "@/server/services/contracts";
import type { LookupOption } from "@/server/services/lookups";

const STATUSES = ["DRAFT", "ACTIVE", "EXPIRED", "CANCELLED"] as const;

export function ContractsTable({ rows, products }: { rows: ContractRow[]; products: LookupOption[] }) {
  const t = useTranslations();
  const f = useFmt();
  const columns = useMemo<ColumnDef<ContractRow, unknown>[]>(
    () => [
      {
        accessorKey: "number",
        header: t("contracts.number"),
        meta: { label: t("contracts.number") },
        cell: ({ row }) => (
          <Link href={`/contracts/${row.original.id}`} className="font-medium hover:underline" dir="ltr">
            {row.original.number}
          </Link>
        ),
      },
      {
        id: "client",
        accessorFn: (r) => f.name(r.client),
        header: t("contracts.client"),
        meta: { label: t("contracts.client") },
        cell: ({ row }) => (
          <Link href={`/clients/${row.original.client.id}`} className="hover:underline">
            {f.name(row.original.client)}
          </Link>
        ),
      },
      {
        id: "products",
        accessorFn: (r) => r.products.map((p) => p.id),
        header: t("contracts.products"),
        enableSorting: false,
        meta: { label: t("contracts.products"), exportValue: (r) => r.products.map((p) => f.name(p)).join(", ") },
        cell: ({ row }) => <span className="text-sm">{row.original.products.map((p) => f.name(p)).join("، ")}</span>,
      },
      {
        accessorKey: "contractDate",
        header: t("contracts.contractDate"),
        meta: { label: t("contracts.contractDate"), exportValue: (r) => r.contractDate.slice(0, 10) },
        cell: ({ row }) => f.date(row.original.contractDate),
      },
      {
        accessorKey: "status",
        header: t("contracts.status"),
        meta: { label: t("contracts.status"), exportValue: (r) => t(`contractStatus.${r.status}`) },
        cell: ({ row }) => <StatusBadge color={STATUS_COLOR[row.original.status]}>{t(`contractStatus.${row.original.status}`)}</StatusBadge>,
      },
      {
        accessorKey: "value",
        header: t("contracts.value"),
        meta: { label: t("contracts.value"), align: "end" },
        cell: ({ row }) => f.money(row.original.value, row.original.currency),
      },
      { accessorKey: "currency", header: t("contracts.currency"), meta: { label: t("contracts.currency") } },
      {
        id: "nextAmc",
        accessorFn: (r) => r.nextAmcDue ?? "9999",
        header: t("contracts.nextAmc"),
        meta: {
          label: t("contracts.nextAmc"),
          exportValue: (r) => (r.nextAmcDue ? `${r.nextAmcDue.slice(0, 10)} — ${r.nextAmcAmount}` : ""),
        },
        cell: ({ row }) => {
          const r = row.original;
          if (!r.nextAmcDue) return "—";
          return (
            <div className={r.nextAmcOverdue ? "text-destructive" : ""}>
              <div className="font-medium">{f.date(r.nextAmcDue)}</div>
              <div className="num text-xs opacity-80">{f.money(r.nextAmcAmount, r.currency)}</div>
            </div>
          );
        },
      },
      {
        accessorKey: "overdueCount",
        header: t("amcStatus.OVERDUE"),
        meta: { label: t("amcStatus.OVERDUE"), align: "end" },
        cell: ({ row }) =>
          row.original.overdueCount ? (
            <StatusBadge color="red">{t("contracts.overdueBadge", { count: row.original.overdueCount })}</StatusBadge>
          ) : (
            <span className="text-muted-foreground">0</span>
          ),
      },
    ],
    [t, f],
  );
  return (
    <DataTable
      data={rows}
      columns={columns}
      exportName="contracts"
      rowHref={(r) => `/contracts/${r.id}`}
      searchText={(r) => [r.number, r.title, r.client.nameAr, r.client.nameEn, ...r.products.flatMap((p) => [p.labelAr, p.labelEn])].join(" ")}
      filters={[
        { columnId: "status", label: t("contracts.status"), options: STATUSES.map((s) => ({ value: s, label: t(`contractStatus.${s}`) })) },
        { columnId: "products", label: t("contracts.products"), options: products.map((p) => ({ value: p.id, label: f.name(p) })) },
      ]}
    />
  );
}
