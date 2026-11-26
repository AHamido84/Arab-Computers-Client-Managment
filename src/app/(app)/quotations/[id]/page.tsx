import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Building2, FolderKanban, Lock, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, STATUS_COLOR } from "@/components/shared/status-badge";
import { DeleteButton } from "@/components/shared/delete-button";
import { DocumentMenu } from "@/components/shared/document-menu";
import { TotalsBlock } from "@/components/shared/totals-summary-server";
import { AttachmentsPanel } from "@/components/attachments/attachments-panel";
import { toAttachmentItems } from "@/components/attachments/types";
import { QuotationActions } from "@/components/quotations/quotation-actions";
import { can, requirePagePermission } from "@/server/auth-guard";
import { getQuotation } from "@/server/services/quotations";
import { quotationVars } from "@/server/services/template-vars";
import { fillPlaceholders } from "@/lib/templates/render";
import { listAttachments } from "@/server/services/attachments";
import { getSettings } from "@/server/services/settings";
import { deleteQuotationAction } from "@/server/actions/quotations";
import { computeTotals, lineTotal } from "@/lib/totals";
import { formatDate, formatDateTime, formatMoney, formatNumber, todayUTC } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/quotations/[id]">) {
  const { id } = await params;
  const q = await getQuotation(id);
  return { title: q ? `${q.number} v${q.version}` : "404" };
}

export default async function QuotationPage({ params }: PageProps<"/quotations/[id]">) {
  const user = await requirePagePermission("read");
  const { id } = await params;
  const [t, locale, q, files, settings] = await Promise.all([
    getTranslations(),
    getLocale() as Promise<AppLocale>,
    getQuotation(id),
    listAttachments("QUOTATION", id),
    getSettings(),
  ]);
  if (!q) notFound();
  const dg = settings.arabicDigits;
  const canWrite = can(user.role, "write");
  const totals = computeTotals(q.items, q.discount, q.vatPercent);
  const expired = (q.status === "DRAFT" || q.status === "SENT") && q.validUntil < todayUTC();
  const docDir = q.lang === "ar" ? "rtl" : "ltr";
  const project = await db.deliveryProject.findFirst({ where: { quotationId: q.id }, select: { id: true } });
  // Show intro/terms with placeholders filled, exactly as they will print.
  const vars = await quotationVars(q);
  const intro = fillPlaceholders(q.introText, vars);
  const terms = fillPlaceholders(q.terms, vars);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span dir="ltr">
              {q.number} <span className="text-muted-foreground">v{q.version}</span>
            </span>
            <StatusBadge color={STATUS_COLOR[q.status]}>{t(`quotationStatus.${q.status}`)}</StatusBadge>
            {expired && <StatusBadge color="orange">{t("quotations.expired")}</StatusBadge>}
          </span>
        }
        description={
          <span className="flex flex-wrap gap-x-4">
            <Link href={`/clients/${q.clientId}`} className="inline-flex items-center gap-1 hover:underline">
              <Building2 className="size-3.5" /> {locale === "ar" ? q.client.nameAr : q.client.nameEn}
            </Link>
            {q.title && <span dir="auto">{q.title}</span>}
          </span>
        }
        actions={
          <>
            <DocumentMenu kind="quotation" id={q.id} defaultLang={q.lang} canEmail={can(user.role, "sendEmail")} />
            {q.status === "ACCEPTED" && (project || can(user.role, "manageDelivery")) && (
              <Button asChild variant={project ? "outline" : "default"}>
                <Link href={project ? `/delivery/${project.id}` : `/delivery/new?quotationId=${q.id}`}>
                  <FolderKanban /> {project ? t("delivery.viewProject") : t("delivery.createFromQuotation")}
                </Link>
              </Button>
            )}
            {canWrite && (
            <>
              <QuotationActions id={q.id} status={q.status} canManageDelivery={can(user.role, "manageDelivery")} />
              {q.status === "DRAFT" && (
                <Button asChild variant="outline">
                  <Link href={`/quotations/${q.id}/edit`}>
                    <Pencil /> {t("common.edit")}
                  </Link>
                </Button>
              )}
              {q.status === "DRAFT" && can(user.role, "delete") && (
                <DeleteButton action={deleteQuotationAction.bind(null, q.id)} redirectTo="/quotations" successKey="quotations.deleted" />
              )}
            </>
            )}
          </>
        }
      />

      {q.status !== "DRAFT" && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <Lock className="size-4" /> {t("quotations.lockedNotice")}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardContent className="space-y-4" dir={docDir}>
              {intro && <p className="whitespace-pre-wrap text-sm">{intro}</p>}
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>{t("quotations.itemTitle")}</TableHead>
                      <TableHead>{t("quotations.dueDate")}</TableHead>
                      <TableHead className="text-end">{t("quotations.qty")}</TableHead>
                      <TableHead className="text-end">{t("quotations.unitPrice")}</TableHead>
                      <TableHead className="text-end">{t("quotations.lineTotal")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {q.items.map((i, idx) => (
                      <TableRow key={i.id}>
                        <TableCell className="align-top text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="min-w-56 whitespace-normal align-top">
                          <div className="font-medium">{i.title}</div>
                          {i.scope && <div className="whitespace-pre-wrap text-xs text-muted-foreground">{i.scope}</div>}
                          {i.request && (
                            <Link href={`/requests/${i.request.id}`} className="text-xs text-primary hover:underline" dir="ltr">
                              {i.request.number}
                            </Link>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          {i.startDate && <div className="text-xs text-muted-foreground">{formatDate(i.startDate, locale, dg)} →</div>}
                          {formatDate(i.dueDate, locale, dg)}
                        </TableCell>
                        <TableCell className="num text-end align-top">{formatNumber(i.qty, locale, dg)}</TableCell>
                        <TableCell className="num text-end align-top">{formatMoney(i.unitPrice, q.currency, locale, dg)}</TableCell>
                        <TableCell className="num text-end align-top">{formatMoney(lineTotal(i), q.currency, locale, dg)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TotalsBlock totals={totals} currency={q.currency} locale={locale} digits={dg} />
            </CardContent>
          </Card>
          {terms && (
            <Card>
              <CardHeader>
                <CardTitle>{t("quotations.terms")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm" dir={docDir}>
                  {terms}
                </p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>{t("files.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentsPanel entityType="QUOTATION" entityId={q.id} items={toAttachmentItems(files)} canWrite={canWrite} canDelete={can(user.role, "delete")} revalidate={`/quotations/${q.id}`} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("common.details")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <F label={t("quotations.issueDate")} value={formatDate(q.issueDate, locale, dg)} />
              <F label={t("quotations.validUntil")} value={<span className={expired ? "text-orange-700 dark:text-orange-300" : ""}>{formatDate(q.validUntil, locale, dg)}</span>} />
              <F label={t("quotations.lang")} value={t(`languages.${q.lang}`)} />
              <F label={t("contracts.currency")} value={q.currency} />
              <F label={t("quotations.sentAt")} value={formatDateTime(q.sentAt, locale, dg)} />
              <F label={t("quotations.decidedAt")} value={formatDateTime(q.decidedAt, locale, dg)} />
              <F className="col-span-2" label={t("common.grandTotal")} value={<span className="num text-lg font-semibold">{formatMoney(totals.total, q.currency, locale, dg)}</span>} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("quotations.versions")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {q.versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                    {v.id === q.id ? (
                      <span className="font-semibold">v{v.version}</span>
                    ) : (
                      <Link href={`/quotations/${v.id}`} className="text-primary hover:underline">
                        v{v.version}
                      </Link>
                    )}
                    <span className="text-muted-foreground">{formatDate(v.issueDate, locale, dg)}</span>
                    <StatusBadge color={STATUS_COLOR[v.status]}>{t(`quotationStatus.${v.status}`)}</StatusBadge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function F({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
