"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { useFmt } from "@/components/shared/format-provider";
import { SoftwareDialog } from "./software-dialog";
import type { SoftwareRow } from "@/server/services/software";

export function SoftwareTable({ rows, canWrite }: { rows: SoftwareRow[]; canWrite: boolean }) {
  const t = useTranslations();
  const f = useFmt();
  const columns = useMemo<ColumnDef<SoftwareRow, unknown>[]>(() => {
    const cols: ColumnDef<SoftwareRow, unknown>[] = [
      {
        id: "name",
        accessorFn: (r) => f.name({ nameAr: r.nameAr, nameEn: r.nameEn }),
        header: t("software.name"),
        meta: { label: t("software.name") },
        cell: ({ row }) => (
          <div className="min-w-48 max-w-96 whitespace-normal">
            <Link href={`/software/${row.original.id}`} className="font-medium hover:underline">
              {f.name({ nameAr: row.original.nameAr, nameEn: row.original.nameEn })}
            </Link>
            <div className="text-xs text-muted-foreground" dir={f.locale === "ar" ? "ltr" : "rtl"}>
              {f.locale === "ar" ? row.original.nameEn : row.original.nameAr}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "description",
        header: t("software.description"),
        meta: { label: t("software.description") },
        enableSorting: false,
        cell: ({ row }) => <p className="line-clamp-2 max-w-md min-w-48 whitespace-normal text-sm text-muted-foreground" dir="auto">{row.original.description ?? "—"}</p>,
      },
      { accessorKey: "clients", header: t("software.clients"), meta: { label: t("software.clients") }, cell: ({ row }) => <span className="num">{f.number(row.original.clients)}</span> },
      {
        accessorKey: "contracts",
        header: t("software.contracts"),
        meta: { label: t("software.contracts") },
        cell: ({ row }) => (
          <span className="num">
            {f.number(row.original.contracts)}
            {row.original.activeContracts > 0 && <span className="text-xs text-muted-foreground"> ({t("software.activeCount", { count: row.original.activeContracts })})</span>}
          </span>
        ),
      },
      {
        id: "status",
        accessorFn: (r) => (r.active ? "active" : "inactive"),
        header: t("software.status"),
        meta: { label: t("software.status") },
        cell: ({ row }) => (
          <StatusBadge color={row.original.active ? "green" : "slate"}>{t(row.original.active ? "software.activeLabel" : "software.inactiveLabel")}</StatusBadge>
        ),
      },
    ];
    if (canWrite)
      cols.push({
        id: "actions",
        header: () => <span className="sr-only">{t("common.actions")}</span>,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <SoftwareDialog compact software={{ id: row.original.id, nameAr: row.original.nameAr, nameEn: row.original.nameEn, description: row.original.description ?? "", active: row.original.active }} />
        ),
      });
    return cols;
  }, [t, f, canWrite]);

  return (
    <DataTable
      data={rows}
      columns={columns}
      searchText={(r) => [r.nameAr, r.nameEn, r.description ?? ""].join(" ")}
      filters={[{ columnId: "status", label: t("software.status"), options: [{ value: "active", label: t("software.activeLabel") }, { value: "inactive", label: t("software.inactiveLabel") }] }]}
      exportName="software"
    />
  );
}
