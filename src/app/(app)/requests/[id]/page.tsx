import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, Building2, FilePlus2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, STATUS_COLOR } from "@/components/shared/status-badge";
import { DeleteButton } from "@/components/shared/delete-button";
import { TotalsBlock } from "@/components/shared/totals-summary-server";
import { AttachmentsPanel } from "@/components/attachments/attachments-panel";
import { toAttachmentItems } from "@/components/attachments/types";
import { RequestStatusChanger } from "@/components/requests/status-changer";
import { can, requireUser } from "@/server/auth-guard";
import { getRequest } from "@/server/services/requests";
import { listAttachments } from "@/server/services/attachments";
import { getSettings } from "@/server/services/settings";
import { deleteRequestAction } from "@/server/actions/requests";
import { computeTotals, lineTotal } from "@/lib/totals";
import { isRequestOverdue } from "@/lib/validation/request";
import { formatDate, formatMoney, formatNumber, todayUTC } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/requests/[id]">) {
  const { id } = await params;
  const r = await getRequest(id);
  return { title: r ? `${r.number} · ${r.title}` : "404" };
}

export default async function RequestPage({ params }: PageProps<"/requests/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const [t, locale, r, files, settings] = await Promise.all([
    getTranslations(),
    getLocale() as Promise<AppLocale>,
    getRequest(id),
    listAttachments("REQUEST", id),
    getSettings(),
  ]);
  if (!r) notFound();
  const dg = settings.arabicDigits;
  const canWrite = can(user.role, "write");
  const overdue = isRequestOverdue(r, todayUTC());
  const totals = computeTotals(r.items, r.discount, r.vatPercent);
  const quotations = [...new Map(r.quotationItems.map((qi) => [qi.quotation.id, qi.quotation])).values()];
  const L = (o: { labelAr: string; labelEn: string }) => (locale === "ar" ? o.labelAr : o.labelEn);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {r.title}
            <StatusBadge color={STATUS_COLOR[r.priority]}>{t(`priority.${r.priority}`)}</StatusBadge>
            {overdue && (
              <StatusBadge color="red">
                <AlertTriangle className="size-3" /> {t("requests.overdue")}
              </StatusBadge>
            )}
          </span>
        }
        description={
          <span className="flex flex-wrap gap-x-4">
            <span dir="ltr">{r.number}</span>
            <Link href={`/clients/${r.clientId}`} className="inline-flex items-center gap-1 hover:underline">
              <Building2 className="size-3.5" /> {locale === "ar" ? r.client.nameAr : r.client.nameEn}
            </Link>
          </span>
        }
        actions={
          canWrite ? (
            <>
              <RequestStatusChanger id={r.id} status={r.status} />
              <Button asChild variant="outline">
                <Link href={`/requests/${r.id}/edit`}>
                  <Pencil /> {t("common.edit")}
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/quotations/new?clientId=${r.clientId}&requestIds=${r.id}`}>
                  <FilePlus2 /> {t("requests.createQuotation")}
                </Link>
              </Button>
              {can(user.role, "delete") && <DeleteButton action={deleteRequestAction.bind(null, r.id)} redirectTo="/requests" successKey="requests.deleted" />}
            </>
          ) : (
            <StatusBadge color={STATUS_COLOR[r.status]}>{t(`requestStatus.${r.status}`)}</StatusBadge>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>{t("requests.details")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <F label={t("requests.status")} value={<StatusBadge color={STATUS_COLOR[r.status]}>{t(`requestStatus.${r.status}`)}</StatusBadge>} />
            <F label={t("requests.type")} value={r.type ? L(r.type) : "—"} />
            <F label={t("requests.assignee")} value={r.assignee?.name ?? t("requests.unassigned")} />
            <F
              label={t("requests.contract")}
              value={
                r.contract ? (
                  <Link className="hover:underline" dir="ltr" href={`/contracts/${r.contract.id}`}>
                    {r.contract.number}
                  </Link>
                ) : (
                  "—"
                )
              }
            />
            <F label={t("requests.requestDate")} value={formatDate(r.requestDate, locale, dg)} />
            <F label={t("requests.dueDate")} value={<span className={overdue ? "font-medium text-destructive" : ""}>{formatDate(r.dueDate, locale, dg)}</span>} />
            <F label={t("requests.estimatedHours")} value={r.estimatedHours != null ? formatNumber(r.estimatedHours, locale, dg) : "—"} />
            {r.description && <F className="col-span-2" label={t("requests.description")} value={<p className="whitespace-pre-wrap">{r.description}</p>} />}
          </CardContent>
        </Card>

        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("requests.items")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {r.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("requests.noItems")}</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>{t("requests.item")}</TableHead>
                        <TableHead className="text-end">{t("requests.qty")}</TableHead>
                        <TableHead className="text-end">{t("requests.unitPrice")}</TableHead>
                        <TableHead className="text-end">{t("requests.lineTotal")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.items.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell className="whitespace-normal">
                            <div className="font-medium">{i.item}</div>
                            {i.description && <div className="text-xs text-muted-foreground">{i.description}</div>}
                          </TableCell>
                          <TableCell className="num text-end">{formatNumber(i.qty, locale, dg)}</TableCell>
                          <TableCell className="num text-end">{formatMoney(i.unitPrice, r.currency, locale, dg)}</TableCell>
                          <TableCell className="num text-end">{formatMoney(lineTotal(i), r.currency, locale, dg)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <TotalsBlock totals={totals} currency={r.currency} locale={locale} digits={dg} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("requests.quotations")}</CardTitle>
            </CardHeader>
            <CardContent>
              {quotations.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("requests.notQuoted")}</p>
              ) : (
                <ul className="divide-y text-sm">
                  {quotations.map((q) => (
                    <li key={q.id} className="flex items-center justify-between gap-3 py-2">
                      <Link href={`/quotations/${q.id}`} className="font-medium hover:underline" dir="ltr">
                        {q.number} v{q.version}
                      </Link>
                      <span className="text-muted-foreground">{formatDate(q.issueDate, locale, dg)}</span>
                      <StatusBadge color={STATUS_COLOR[q.status]}>{t(`quotationStatus.${q.status}`)}</StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("files.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <AttachmentsPanel entityType="REQUEST" entityId={r.id} items={toAttachmentItems(files)} canWrite={canWrite} canDelete={can(user.role, "delete")} revalidate={`/requests/${r.id}`} />
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
