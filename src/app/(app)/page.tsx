import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  AlertTriangle,
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
import { getDashboardKpis } from "@/server/services/dashboard";
import { getSettings } from "@/server/services/settings";
import { daysBetween, formatDate, formatMoney, formatMoneyCompact, formatNumber, todayUTC } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";

export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [t, locale, k, settings] = await Promise.all([
    getTranslations(),
    getLocale() as Promise<AppLocale>,
    getDashboardKpis(),
    getSettings(),
  ]);
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
          hint={n(k.overdueAmcCount)}
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
