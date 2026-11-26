import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Building2, FolderKanban, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, STATUS_COLOR } from "@/components/shared/status-badge";
import { DeleteButton } from "@/components/shared/delete-button";
import { DocumentMenu } from "@/components/shared/document-menu";
import { AmcScheduleGrid } from "@/components/contracts/amc-schedule-grid";
import { AttachmentsPanel } from "@/components/attachments/attachments-panel";
import { toAttachmentItems } from "@/components/attachments/types";
import { can, requirePagePermission } from "@/server/auth-guard";
import { getContract, serializeAmcLines } from "@/server/services/contracts";
import { listAttachments } from "@/server/services/attachments";
import { getSettings } from "@/server/services/settings";
import { deleteContractAction } from "@/server/actions/contracts";
import { baseAmc, defaultAmcStartDate } from "@/lib/amc/engine";
import { formatDate, formatMoney, formatNumber, todayUTC } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/contracts/[id]">) {
  const { id } = await params;
  const c = await getContract(id);
  return { title: c?.number ?? "404" };
}

export default async function ContractPage({ params }: PageProps<"/contracts/[id]">) {
  const user = await requirePagePermission("read");
  const { id } = await params;
  const [t, locale, c, files, settings] = await Promise.all([
    getTranslations(),
    getLocale() as Promise<AppLocale>,
    getContract(id),
    listAttachments("CONTRACT", id),
    getSettings(),
  ]);
  if (!c) notFound();
  const dg = settings.arabicDigits;
  const L = (o: { labelAr: string; labelEn: string }) => (locale === "ar" ? o.labelAr : o.labelEn);
  const canWrite = can(user.role, "write");
  const clientName = locale === "ar" ? c.client.nameAr : c.client.nameEn;
  const amcStart = c.amcStartDate ?? defaultAmcStartDate(c.contractDate);
  const project = await db.deliveryProject.findFirst({ where: { contractId: c.id }, select: { id: true } });

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span dir="ltr">{c.number}</span>
            <StatusBadge color={STATUS_COLOR[c.status]}>{t(`contractStatus.${c.status}`)}</StatusBadge>
          </span>
        }
        description={
          <Link href={`/clients/${c.clientId}`} className="inline-flex items-center gap-1 hover:underline">
            <Building2 className="size-3.5" /> {clientName}
            {c.title ? ` — ${c.title}` : ""}
          </Link>
        }
        actions={
          <>
            <DocumentMenu kind="contract" id={c.id} defaultLang={c.client.preferredLang} canEmail={can(user.role, "sendEmail")} />
            {c.status === "ACTIVE" && (project || can(user.role, "manageDelivery")) && (
              <Button asChild variant={project ? "outline" : "default"}>
                <Link href={project ? `/delivery/${project.id}` : `/delivery/new?contractId=${c.id}`}>
                  <FolderKanban /> {project ? t("delivery.viewProject") : t("delivery.createFromQuotation")}
                </Link>
              </Button>
            )}
            {canWrite && (
            <>
              <Button asChild variant="outline">
                <Link href={`/contracts/${c.id}/edit`}>
                  <Pencil /> {t("common.edit")}
                </Link>
              </Button>
              {can(user.role, "delete") && (
                <DeleteButton action={deleteContractAction.bind(null, c.id)} redirectTo={`/clients/${c.clientId}`} successKey="contracts.deleted" />
              )}
            </>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>{t("contracts.details")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <Field label={t("contracts.products")} className="col-span-2" value={c.products.map((p) => L(p.product)).join("، ")} />
            <Field label={t("contracts.value")} value={<span className="num font-semibold">{formatMoney(c.value, c.currency, locale, dg)}</span>} />
            <Field label={t("contracts.currency")} value={c.currency} />
            <Field label={t("contracts.contractDate")} value={formatDate(c.contractDate, locale, dg)} />
            <Field label={t("contracts.startDate")} value={formatDate(c.startDate, locale, dg)} />
            <Field label={t("contracts.endDate")} value={formatDate(c.endDate, locale, dg)} />
            <Field label={t("contracts.paymentTerms")} value={c.paymentTerms ?? "—"} className="col-span-2" />
            {c.notes && <Field label={t("contracts.notes")} value={<span className="whitespace-pre-wrap">{c.notes}</span>} className="col-span-2" />}
            {c.amcEnabled && (
              <>
                <div className="col-span-2 border-t pt-3 font-medium">{t("contracts.amcSection")}</div>
                <Field label={t("contracts.amcPercent")} value={`${formatNumber(c.amcPercent, locale, dg)}%`} />
                <Field label={t("contracts.baseAmc")} value={<span className="num">{formatMoney(baseAmc(Number(c.value), Number(c.amcPercent)), c.currency, locale, dg)}</span>} />
                <Field label={t("contracts.amcIncrease")} value={`${formatNumber(c.amcIncreasePercent, locale, dg)}%`} />
                <Field label={t("contracts.amcMethod")} value={t(`amcMethod.${c.amcMethod}`)} />
                <Field label={t("contracts.amcStartDate")} value={formatDate(amcStart, locale, dg)} />
                <Field label={t("contracts.amcYears")} value={formatNumber(c.amcYears, locale, dg)} />
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("amc.schedule")}</CardTitle>
              <CardDescription>{t("amc.adjustHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              {c.amcEnabled && c.amcLines.length ? (
                <AmcScheduleGrid
                  contractId={c.id}
                  lines={serializeAmcLines(c.amcLines)}
                  currency={c.currency}
                  defaultIncrease={Number(c.amcIncreasePercent)}
                  canWrite={canWrite}
                  canEmail={can(user.role, "sendEmail")}
                  docLang={c.client.preferredLang}
                  today={todayUTC().toISOString()}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{t("contracts.noAmc")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("files.title")}</CardTitle>
              <CardDescription>{t("contracts.signedHint")}</CardDescription>
            </CardHeader>
            <CardContent>
              <AttachmentsPanel
                entityType="CONTRACT"
                entityId={c.id}
                items={toAttachmentItems(files)}
                canWrite={canWrite}
                canDelete={can(user.role, "delete")}
                revalidate={`/contracts/${c.id}`}
                defaultLabel={t("files.signedContract")}
              />
            </CardContent>
          </Card>

          {c.requests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("contracts.linkedRequests")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y text-sm">
                  {c.requests.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                      <span>
                        <span className="text-muted-foreground" dir="ltr">
                          {r.number}
                        </span>{" "}
                        · {r.title}
                      </span>
                      <StatusBadge color={STATUS_COLOR[r.status]}>{t(`requestStatus.${r.status}`)}</StatusBadge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
