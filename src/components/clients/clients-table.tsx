"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { useFmt } from "@/components/shared/format-provider";
import type { ClientRow } from "@/server/services/clients";
import type { LookupOption } from "@/server/services/lookups";

export function ClientsTable({
  rows,
  statuses,
  industries,
  managers,
}: {
  rows: ClientRow[];
  statuses: LookupOption[];
  industries: LookupOption[];
  managers: { id: string; name: string }[];
}) {
  const t = useTranslations("clients");
  const f = useFmt();

  const columns = useMemo<ColumnDef<ClientRow, unknown>[]>(
    () => [
      { accessorKey: "code", header: t("code"), meta: { label: t("code"), className: "w-24" }, cell: ({ row }) => <span dir="ltr" className="text-muted-foreground">{row.original.code}</span> },
      {
        id: "name",
        accessorFn: (r) => f.name(r),
        header: t("name"),
        meta: { label: t("name") },
        cell: ({ row }) => (
          <div className="min-w-48">
            <Link href={`/clients/${row.original.id}`} className="font-medium hover:underline">
              {f.name(row.original)}
            </Link>
            <div className="text-xs text-muted-foreground" dir="auto">{f.locale === "ar" ? row.original.nameEn : row.original.nameAr}</div>
          </div>
        ),
      },
      {
        id: "status",
        accessorFn: (r) => r.status.id,
        header: t("status"),
        meta: { label: t("status"), exportValue: (r) => f.name(r.status) },
        sortingFn: (a, b) => f.name(a.original.status).localeCompare(f.name(b.original.status)),
        cell: ({ row }) => <StatusBadge color={row.original.status.color}>{f.name(row.original.status)}</StatusBadge>,
      },
      {
        id: "industry",
        accessorFn: (r) => r.industry?.id ?? "",
        header: t("industry"),
        meta: { label: t("industry"), exportValue: (r) => (r.industry ? f.name(r.industry) : "") },
        cell: ({ row }) => (row.original.industry ? f.name(row.original.industry) : "—"),
      },
      {
        id: "manager",
        accessorFn: (r) => r.manager?.id ?? "",
        header: t("manager"),
        meta: { label: t("manager"), exportValue: (r) => r.manager?.name ?? "" },
        cell: ({ row }) => row.original.manager?.name ?? <span className="text-muted-foreground">{t("unassigned")}</span>,
      },
      {
        id: "contact",
        accessorFn: (r) => r.primaryContact?.name ?? "",
        header: t("primaryContact"),
        meta: { label: t("primaryContact"), exportValue: (r) => [r.primaryContact?.name, r.primaryContact?.phone, r.primaryContact?.email].filter(Boolean).join(" · ") },
        cell: ({ row }) =>
          row.original.primaryContact ? (
            <div className="text-sm">
              <div dir="auto">{row.original.primaryContact.name}</div>
              <div className="text-xs text-muted-foreground" dir="ltr">
                {row.original.primaryContact.phone}
              </div>
            </div>
          ) : (
            "—"
          ),
      },
      { accessorKey: "city", header: t("city"), meta: { label: t("city") }, cell: ({ row }) => row.original.city ?? "—" },
      { accessorKey: "contractsCount", header: t("contractsCount"), meta: { label: t("contractsCount"), align: "end" } },
      { accessorKey: "openRequests", header: t("openRequests"), meta: { label: t("openRequests"), align: "end" } },
    ],
    [t, f],
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      exportName="clients"
      rowHref={(r) => `/clients/${r.id}`}
      searchText={(r) => [r.code, r.nameAr, r.nameEn, r.city, r.primaryContact?.name, r.primaryContact?.phone, r.primaryContact?.email].join(" ")}
      filters={[
        { columnId: "status", label: t("status"), options: statuses.map((s) => ({ value: s.id, label: f.name(s) })) },
        { columnId: "industry", label: t("industry"), options: industries.map((s) => ({ value: s.id, label: f.name(s) })) },
        { columnId: "manager", label: t("manager"), options: managers.map((m) => ({ value: m.id, label: m.name })) },
      ]}
    />
  );
}
