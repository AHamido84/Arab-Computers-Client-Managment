import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { FileSpreadsheet, FileText, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { ReportFiltersBar } from "@/components/reports/report-filters";
import { requirePagePermission } from "@/server/auth-guard";
import { buildReport, defaultFilters, formatCell, parseFilters, REPORT_TYPES, type ReportType } from "@/server/services/reports";
import { getAssignableUsers, getClientOptions } from "@/server/services/lookups";
import type { AppLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  return { title: (await getTranslations("reports"))("title") };
}

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  await requirePagePermission("read");
  const sp = (await searchParams) as Record<string, string | undefined>;
  const type: ReportType = REPORT_TYPES.includes(sp.type as ReportType) ? (sp.type as ReportType) : "amc";
  const explicit = parseFilters(sp);
  const filters = Object.values(explicit).some(Boolean) ? explicit : defaultFilters(type);
  const [t, locale, clients, users] = await Promise.all([getTranslations(), getLocale() as Promise<AppLocale>, getClientOptions(), getAssignableUsers()]);
  const report = await buildReport(type, filters, locale);
  const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]);
  q.set("lang", locale);
  const exportUrl = (format: "pdf" | "xlsx") => `/api/reports/${type}?${q}&format=${format}`;
  const canExport = !(type === "statement" && !filters.clientId);

  return (
    <>
      <PageHeader
        title={t("reports.title")}
        actions={
          canExport && (
            <>
              <Button asChild variant="outline">
                <a href={exportUrl("pdf")} target="_blank" rel="noreferrer">
                  <FileText /> {t("reports.exportPdf")}
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={exportUrl("xlsx")}>
                  <FileSpreadsheet /> {t("reports.exportExcel")}
                </a>
              </Button>
            </>
          )
        }
      />
      <div className="mb-4 overflow-x-auto">
        <div className="inline-flex rounded-lg border p-0.5" role="tablist">
          {REPORT_TYPES.map((rt) => (
            <Button key={rt} asChild size="sm" variant={rt === type ? "secondary" : "ghost"}>
              <Link href={`/reports?type=${rt}`} role="tab" aria-selected={rt === type}>
                {t(`reports.${rt}`)}
              </Link>
            </Button>
          ))}
        </div>
      </div>
      <ReportFiltersBar key={`${type}-${JSON.stringify(filters)}`} type={type} value={filters} clients={clients} users={users} />

      {type === "statement" && !filters.clientId ? (
        <EmptyState className="mt-6" icon={SearchX} title={t("reports.chooseClient")} />
      ) : (
        <>
          <div className="mt-4 mb-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{report.title}</span>
            {report.filtersText && <> · {report.filtersText}</>} · {t("reports.currencyNote", { currency: report.currency })}
          </div>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {report.summary.map(([k, v]) => (
              <Card key={k} className="gap-1 py-4">
                <CardContent className="px-4">
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="num text-lg font-semibold">{v}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          {report.empty ? (
            <EmptyState icon={SearchX} title={t("reports.empty")} />
          ) : (
            <div className="space-y-6">
              {report.tables.map((tb, i) => (
                <Card key={i} className={tb.title ? "" : "py-0"}>
                  {tb.title && (
                    <CardHeader>
                      <CardTitle>{tb.title}</CardTitle>
                    </CardHeader>
                  )}
                  <CardContent className={tb.title ? "" : "p-0"}>
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            {tb.columns.map((c) => (
                              <TableHead key={c.key} className={c.align === "end" ? "text-end" : ""}>
                                {c.label}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tb.rows.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={tb.columns.length} className="h-16 text-center text-muted-foreground">
                                {t("common.noResults")}
                              </TableCell>
                            </TableRow>
                          )}
                          {tb.rows.map((r, ri) => (
                            <TableRow key={ri} className={r._tone === "red" ? "bg-destructive/5" : ""}>
                              {tb.columns.map((c, ci) => {
                                const text = formatCell(c, r, locale);
                                return (
                                  <TableCell key={c.key} className={cn(c.align === "end" && "num text-end", c.type === "text" && "max-w-72 truncate")}>
                                    {c.type === "status" ? (
                                      <StatusBadge color={r._tone ?? "slate"}>{text}</StatusBadge>
                                    ) : ci === 0 && r._href ? (
                                      <Link href={r._href} className="font-medium hover:underline">
                                        {text}
                                      </Link>
                                    ) : (
                                      text
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
