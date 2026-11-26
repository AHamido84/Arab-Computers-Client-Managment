import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  Mail,
  Building2,
  CalendarClock,
  ClipboardList,
  FileSignature,
  FileText,
  TimerOff,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/server/auth-guard";
import { getAmcByMonth, getDashboardKpis, getOverdueLists } from "@/server/services/dashboard";
import { AmcChart } from "@/components/dashboard/amc-chart";
import { Button } from "@/components/ui/button";
import { StatusBadge, STATUS_COLOR } from "@/components/shared/status-badge";
import { can } from "@/server/auth-guard";
import { getSettings } from "@/server/services/settings";
import { daysBetween, formatDate, formatMoney, formatMoneyCompact, formatNumber, todayUTC } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

export default async function DashboardPage() {
  const user = await requireUser();
  // Team members have no access to business data — their home is "My tasks".
  if (!can(user.role, "read")) redirect("/my-tasks");
  const settings = await getSettings();
  const [t, locale, k, months, overdue] = await Promise.all([
    getTranslations(),
    getLocale() as Promise<AppLocale>,
    getDashboardKpis(),
    getAmcByMonth(settings.defaultCurrency),
    getOverdueLists(),
  ]);
  const canEmail = can(user.role, "sendEmail");
  const maxStatus = Math.max(1, ...overdue.byStatus.map((b) => b.count));
  const cur = settings.defaultCurrency;
  const dg = settings.arabicDigits;
  const money = (v: number) => formatMoneyCompact(v, cur, locale, dg);
  const n = (v: number) => formatNumber(v, locale, dg);
  const today = todayUTC();

  return (
    <>
      <PageHeader title={t("dashboard.title")} description={t("dashboard.welcome", { name: user.name ?? "" })} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("dashboard.activeClients")} value={n(k.activeClients)} icon={Building2} />
        <KpiCard label={t("dashboard.activeContracts")} value={n(k.activeContracts)} icon={FileSignature} />
        <KpiCard label={t("dashboard.amcThisMonth")} value={money(k.amcMonth)} icon={CalendarClock} tone="accent" />
        <KpiCard label={t("dashboard.amcThisQuarter")} value={money(k.amcQuarter)} icon={TrendingUp} tone="accent" />
        <KpiCard label={t("dashboard.amcThisYear")} value={money(k.amcYear)} icon={TrendingUp} tone="success" />
        <KpiCard
          label={t("dashboard.overdueAmc")}
          value={money(k.overdueAmcValue)}
          hint={t("dashboard.overdueCount", { count: k.overdueAmcCount })}
          icon={AlertTriangle}
          tone="danger"
        />
        <KpiCard
          label={t("dashboard.openRequests")}
          value={n(k.openRequests)}
          hint={`${t("dashboard.overdueRequests")}: ${n(k.overdueRequests)}`}
          icon={ClipboardList}
          tone={k.overdueRequests ? "danger" : "default"}
        />
        <KpiCard label={t("dashboard.pendingQuotations")} value={money(k.pendingQuotationsValue)} icon={FileText} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3 [&>*]:min-w-0">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.amcByMonth")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AmcChart data={months} currency={cur} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t("dashboard.requestsByStatus")}</CardTitle>
            <Link href="/requests?view=kanban" className="text-sm text-primary hover:underline">
              {t("dashboard.viewAll")}
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {overdue.byStatus.map((b) => (
                <li key={b.status} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{t(`requestStatus.${b.status}`)}</span>
                    <span className="num font-medium">{n(b.count)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted" aria-hidden>
                    <div className="h-2 rounded-full bg-chart-1" style={{ width: `${(b.count / maxStatus) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.overdueAmcList")}</CardTitle>
          </CardHeader>
          <CardContent>
            {overdue.amc.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.noOverdue")}</p>
            ) : (
              <ul className="divide-y">
                {overdue.amc.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link href={`/contracts/${l.contract.id}`} className="font-medium hover:underline">
                        {locale === "ar" ? l.contract.client.nameAr : l.contract.client.nameEn}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        <span dir="ltr">{l.contract.number} · Y{l.yearIndex}</span> · {formatDate(l.dueDate, locale, dg)} ·{" "}
                        <span className="text-destructive">{t("dashboard.overdueBy", { count: -daysBetween(today, l.dueDate) })}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="num font-medium">{formatMoney(l.amount, l.contract.currency, locale, dg)}</span>
                      {canEmail && (
                        <Button asChild size="icon-sm" variant="outline" aria-label={t("notifications.prepareEmail")} title={t("notifications.prepareEmail")}>
                          <Link href={`/emails/compose?kind=amc&id=${l.id}`}>
                            <Mail />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.overdueRequestsList")}</CardTitle>
          </CardHeader>
          <CardContent>
            {overdue.requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.noOverdue")}</p>
            ) : (
              <ul className="divide-y">
                {overdue.requests.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link href={`/requests/${r.id}`} className="font-medium hover:underline">
                        {r.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        <span dir="ltr">{r.number}</span> · {locale === "ar" ? r.client.nameAr : r.client.nameEn}
                        {r.assignee ? ` · ${r.assignee.name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge color={STATUS_COLOR[r.priority]}>{t(`priority.${r.priority}`)}</StatusBadge>
                      <span className="text-xs font-medium text-destructive">{t("dashboard.overdueBy", { count: -daysBetween(today, r.dueDate!) })}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("dashboard.upcomingRenewals")}</CardTitle>
        </CardHeader>
        <CardContent>
          {k.upcoming.length === 0 ? (
            <EmptyState icon={TimerOff} title={t("common.noResults")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("nav.clients")}</TableHead>
                  <TableHead>{t("nav.contracts")}</TableHead>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead className="text-end">{t("common.amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {k.upcoming.map((l) => {
                  const days = daysBetween(today, l.dueDate);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        <Link className="hover:underline" href={`/clients/${l.contract.client.id}`}>
                          {locale === "ar" ? l.contract.client.nameAr : l.contract.client.nameEn}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link className="hover:underline" href={`/contracts/${l.contract.id}`} dir="ltr">
                          {l.contract.number}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {formatDate(l.dueDate, locale, dg)}
                          <Badge variant={days <= 14 ? "destructive" : "secondary"}>
                            {t("common.days", { count: days })}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="num text-end">{formatMoney(l.amount, l.contract.currency, locale, dg)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
