"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Paperclip } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { useFmt } from "@/components/shared/format-provider";

export type EmailRow = {
  id: string;
  createdAt: string;
  client: { id: string; nameAr: string; nameEn: string } | null;
  to: string[];
  cc: string[];
  subject: string;
  status: "SENT" | "FAILED";
  error: string | null;
  provider: string;
  attachmentName: string | null;
  hasAttachment: boolean;
  relatedType: string | null;
  relatedId: string | null;
  sentBy: string | null;
};

const RELATED_HREF: Record<string, (id: string) => string> = {
  quotation: (id) => `/quotations/${id}`,
  contract: (id) => `/contracts/${id}`,
};

export function EmailsTable({ rows }: { rows: EmailRow[] }) {
  const t = useTranslations();
  const f = useFmt();
  const columns = useMemo<ColumnDef<EmailRow, unknown>[]>(
    () => [
      { accessorKey: "createdAt", header: t("email.date"), meta: { label: t("email.date"), exportValue: (r) => r.createdAt }, cell: ({ row }) => f.dateTime(row.original.createdAt) },
      {
        id: "client",
        accessorFn: (r) => r.client?.id ?? "",
        header: t("email.client"),
        meta: { label: t("email.client"), exportValue: (r) => (r.client ? f.name(r.client) : "") },
        cell: ({ row }) =>
          row.original.client ? (
            <Link href={`/clients/${row.original.client.id}?tab=emails`} className="hover:underline">
              {f.name(row.original.client)}
            </Link>
          ) : (
            "—"
          ),
      },
      {
        accessorKey: "subject",
        header: t("email.subject"),
        meta: { label: t("email.subject") },
        cell: ({ row }) => (
          <div className="max-w-96 min-w-56 whitespace-normal">
            <div className="font-medium" dir="auto">
              {row.original.subject}
            </div>
            {row.original.relatedType && row.original.relatedId && RELATED_HREF[row.original.relatedType] && (
              <Link href={RELATED_HREF[row.original.relatedType](row.original.relatedId)} className="text-xs text-primary hover:underline">
                {t(`documents.${row.original.relatedType === "amc" ? "amcNotice" : row.original.relatedType}`)}
              </Link>
            )}
          </div>
        ),
      },
      {
        id: "to",
        accessorFn: (r) => r.to.join(", "),
        header: t("email.recipients"),
        meta: { label: t("email.recipients") },
        cell: ({ row }) => (
          <div className="text-xs" dir="ltr">
            {row.original.to.join(", ")}
            {row.original.cc.length > 0 && <div className="text-muted-foreground">cc: {row.original.cc.join(", ")}</div>}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: t("email.status"),
        meta: { label: t("email.status"), exportValue: (r) => t(`email.${r.status}`) },
        cell: ({ row }) => (
          <span title={row.original.error ?? undefined}>
            <StatusBadge color={row.original.status === "SENT" ? "green" : "red"}>{t(`email.${row.original.status}`)}</StatusBadge>
            {row.original.provider === "outbox" && <span className="ms-1 text-xs text-muted-foreground">(outbox)</span>}
          </span>
        ),
      },
      {
        id: "attachment",
        accessorFn: (r) => r.attachmentName ?? "",
        header: t("email.viewAttachment"),
        enableSorting: false,
        meta: { label: t("email.viewAttachment") },
        cell: ({ row }) =>
          row.original.hasAttachment ? (
            <a href={`/api/emails/${row.original.id}/attachment`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline" dir="ltr">
              <Paperclip className="size-3" /> {row.original.attachmentName}
            </a>
          ) : (
            "—"
          ),
      },
      { id: "sentBy", accessorFn: (r) => r.sentBy ?? "", header: t("email.sentBy"), meta: { label: t("email.sentBy") } },
    ],
    [t, f],
  );
  return (
    <DataTable
      data={rows}
      columns={columns}
      exportName="emails"
      initialSort={[{ id: "createdAt", desc: true }]}
      searchText={(r) => [r.subject, r.client?.nameAr, r.client?.nameEn, ...r.to, ...r.cc].join(" ")}
      filters={[{ columnId: "status", label: t("email.status"), options: (["SENT", "FAILED"] as const).map((s) => ({ value: s, label: t(`email.${s}`) })) }]}
    />
  );
}
