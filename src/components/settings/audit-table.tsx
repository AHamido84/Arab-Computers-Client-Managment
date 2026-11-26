"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { useFmt } from "@/components/shared/format-provider";

export type AuditRow = { id: string; createdAt: string; actor: string | null; action: "CREATE" | "UPDATE" | "DELETE"; entity: string; entityId: string; diff: unknown };

/** Render a diff: UPDATE = {field: {from,to}}, CREATE/DELETE = snapshot. */
function Changes({ row }: { row: AuditRow }) {
  const t = useTranslations("audit");
  const d = row.diff as Record<string, unknown> | null;
  if (!d || typeof d !== "object" || !Object.keys(d).length) return <span className="text-muted-foreground">—</span>;
  const entries = Object.entries(d);
  const isDiff = row.action === "UPDATE" && entries.every(([, v]) => v && typeof v === "object" && "from" in (v as object));
  const show = (v: unknown) => (v === null || v === undefined ? "∅" : typeof v === "object" ? JSON.stringify(v) : String(v));
  return (
    <details className="max-w-xl text-xs">
      <summary className="cursor-pointer text-primary">
        {t("showChanges")} ({entries.length})
      </summary>
      <table className="mt-2 w-full border text-start">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-1 text-start">{t("field")}</th>
            {isDiff && <th className="p-1 text-start">{t("from")}</th>}
            <th className="p-1 text-start">{isDiff ? t("to") : ""}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k} className="border-t align-top">
              <td className="p-1 font-mono">{k}</td>
              {isDiff && <td className="max-w-48 break-all p-1 text-muted-foreground" dir="auto">{show((v as { from: unknown }).from)}</td>}
              <td className="max-w-48 break-all p-1" dir="auto">{show(isDiff ? (v as { to: unknown }).to : v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const t = useTranslations("audit");
  const f = useFmt();
  const entities = [...new Set(rows.map((r) => r.entity))].sort();
  const actors = [...new Set(rows.map((r) => r.actor ?? ""))].filter(Boolean).sort();
  const columns = useMemo<ColumnDef<AuditRow, unknown>[]>(
    () => [
      { accessorKey: "createdAt", header: t("date"), meta: { label: t("date") }, cell: ({ row }) => <span className="whitespace-nowrap">{f.dateTime(row.original.createdAt)}</span> },
      { id: "actor", accessorFn: (r) => r.actor ?? "", header: t("user"), meta: { label: t("user") }, cell: ({ row }) => row.original.actor ?? t("system") },
      {
        accessorKey: "action",
        header: t("action"),
        meta: { label: t("action"), exportValue: (r) => t(r.action) },
        cell: ({ row }) => <StatusBadge color={{ CREATE: "green", UPDATE: "blue", DELETE: "red" }[row.original.action]}>{t(row.original.action)}</StatusBadge>,
      },
      {
        accessorKey: "entity",
        header: t("entity"),
        meta: { label: t("entity"), exportValue: (r) => `${r.entity} ${r.entityId}` },
        cell: ({ row }) => (
          <span className="text-xs">
            <span className="font-medium">{row.original.entity}</span> <span className="font-mono text-muted-foreground">{row.original.entityId.slice(-8)}</span>
          </span>
        ),
      },
      { id: "diff", header: t("changes"), enableSorting: false, meta: { label: t("changes"), exportValue: (r) => JSON.stringify(r.diff ?? {}) }, cell: ({ row }) => <Changes row={row.original} /> },
    ],
    [t, f],
  );
  return (
    <DataTable
      data={rows}
      columns={columns}
      exportName="audit-log"
      pageSize={50}
      initialSort={[{ id: "createdAt", desc: true }]}
      searchText={(r) => `${r.entity} ${r.entityId} ${r.actor ?? ""} ${JSON.stringify(r.diff ?? "")}`}
      filters={[
        { columnId: "entity", label: t("entity"), options: entities.map((e) => ({ value: e, label: e })) },
        { columnId: "action", label: t("action"), options: (["CREATE", "UPDATE", "DELETE"] as const).map((a) => ({ value: a, label: t(a) })) },
        { columnId: "actor", label: t("user"), options: actors.map((a) => ({ value: a, label: a })) },
      ]}
    />
  );
}
