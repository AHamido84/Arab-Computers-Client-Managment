import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Building2, FileSignature, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge, STATUS_COLOR } from "@/components/shared/status-badge";
import { DeleteButton } from "@/components/shared/delete-button";
import { SoftwareDialog } from "@/components/software/software-dialog";
import { can, requirePagePermission } from "@/server/auth-guard";
import { getSoftware } from "@/server/services/software";
import { deleteSoftwareAction } from "@/server/actions/software";
import { formatDate } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/software/[id]">) {
  const { id } = await params;
  const [s, locale] = await Promise.all([getSoftware(id), getLocale()]);
  return { title: s ? (locale === "ar" ? s.nameAr : s.nameEn) : "404" };
}

export default async function SoftwareDetailPage({ params }: PageProps<"/software/[id]">) {
  const user = await requirePagePermission("read");
  const { id } = await params;
  const [t, locale, s] = await Promise.all([getTranslations(), getLocale() as Promise<AppLocale>, getSoftware(id)]);
  if (!s) notFound();
  const ar = locale === "ar";
  const active = s.contracts.filter((c) => c.status === "ACTIVE").length;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {ar ? s.nameAr : s.nameEn}
            <StatusBadge color={s.active ? "green" : "slate"}>{t(s.active ? "software.activeLabel" : "software.inactiveLabel")}</StatusBadge>
          </span>
        }
        description={<span dir={ar ? "ltr" : "rtl"}>{ar ? s.nameEn : s.nameAr}</span>}
        actions={
          <>
            {can(user.role, "write") && <SoftwareDialog software={{ id: s.id, nameAr: s.nameAr, nameEn: s.nameEn, description: s.description ?? "", active: s.active }} />}
            {can(user.role, "delete") && s.contracts.length === 0 && (
              <DeleteButton action={deleteSoftwareAction.bind(null, s.id)} redirectTo="/software" successKey="software.deleted" />
            )}
          </>
        }
      />

      {s.description && <p className="mb-6 whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm" dir="auto">{s.description}</p>}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label={t("software.clients")} value={s.clients} icon={Building2} />
        <KpiCard label={t("software.contracts")} value={s.contracts.length} icon={FileText} />
        <KpiCard label={t("software.activeContracts")} value={active} icon={FileSignature} tone="accent" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("software.usedIn")}</CardTitle>
        </CardHeader>
        <CardContent>
          {s.contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("software.notUsed")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("contracts.number")}</TableHead>
                  <TableHead>{t("contracts.client")}</TableHead>
                  <TableHead>{t("contracts.status")}</TableHead>
                  <TableHead>{t("contracts.startDate")}</TableHead>
                  <TableHead>{t("contracts.endDate")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.contracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/contracts/${c.id}`} className="font-medium hover:underline" dir="ltr">{c.number}</Link>
                      {c.title && <div className="text-xs text-muted-foreground" dir="auto">{c.title}</div>}
                    </TableCell>
                    <TableCell>
                      <Link href={`/clients/${c.client.id}`} className="hover:underline">{ar ? c.client.nameAr : c.client.nameEn}</Link>
                    </TableCell>
                    <TableCell><StatusBadge color={STATUS_COLOR[c.status]}>{t(`contractStatus.${c.status}`)}</StatusBadge></TableCell>
                    <TableCell>{formatDate(c.startDate, locale)}</TableCell>
                    <TableCell>{formatDate(c.endDate, locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
