import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ClipboardPlus, FilePlus2, Paperclip, Globe, Mail, MapPin, MessageCircle, Pencil, Phone, Star, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge, STATUS_COLOR } from "@/components/shared/status-badge";
import { KpiCard } from "@/components/shared/kpi-card";
import { Timeline } from "@/components/shared/timeline";
import { DeleteButton } from "@/components/shared/delete-button";
import { AttachmentsPanel } from "@/components/attachments/attachments-panel";
import { toAttachmentItems } from "@/components/attachments/types";
import { can, requirePagePermission } from "@/server/auth-guard";
import { getClientProfile } from "@/server/services/clients";
import { listAttachments } from "@/server/services/attachments";
import { getSettings } from "@/server/services/settings";
import { deleteClientAction } from "@/server/actions/clients";
import { formatDate, formatDateTime, formatMoney, formatMoneyCompact, todayUTC } from "@/lib/format";
import type { AppLocale } from "@/i18n/config";
import { Banknote, CircleDollarSign, ClipboardList, FileSignature } from "lucide-react";

const TABS = ["overview", "contracts", "requests", "quotations", "emails", "files", "timeline"] as const;

export async function generateMetadata({ params }: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const c = await getClientProfile(id);
  const locale = await getLocale();
  return { title: c ? (locale === "ar" ? c.nameAr : c.nameEn) : "404" };
}

export default async function ClientProfilePage({ params, searchParams }: PageProps<"/clients/[id]">) {
  const user = await requirePagePermission("read");
  const { id } = await params;
  const { tab } = (await searchParams) as { tab?: string };
  const [t, locale, c, files, settings] = await Promise.all([
    getTranslations(),
    getLocale() as Promise<AppLocale>,
    getClientProfile(id),
    listAttachments("CLIENT", id),
    getSettings(),
  ]);
  if (!c) notFound();
  const dg = settings.arabicDigits;
  const name = locale === "ar" ? c.nameAr : c.nameEn;
  const other = locale === "ar" ? c.nameEn : c.nameAr;
  const L = (o: { labelAr: string; labelEn: string }) => (locale === "ar" ? o.labelAr : o.labelEn);
  const canWrite = can(user.role, "write");
  const today = todayUTC();
  const cur = settings.defaultCurrency;

  // Summary figures (in the default currency; other currencies are rare and shown per contract).
  const live = c.contracts.filter((k) => k.status !== "CANCELLED" && k.currency === cur);
  const totalValue = live.reduce((s, k) => s + Number(k.value), 0);
  const lines = live.flatMap((k) => k.amcLines);
  const collected = lines.filter((l) => l.status === "PAID").reduce((s, l) => s + Number(l.paidAmount ?? l.amount), 0);
  const outstanding = lines.filter((l) => l.status !== "PAID" && l.dueDate <= today).reduce((s, l) => s + Number(l.amount), 0);
  const openReq = c.requests.filter((r) => !["CLOSED", "REJECTED", "DELIVERED"].includes(r.status)).length;

  const reqTotal = (r: (typeof c.requests)[number]) => {
    const sub = r.items.reduce((s, i) => s + Number(i.qty) * Number(i.unitPrice), 0) - Number(r.discount);
    return sub * (1 + Number(r.vatPercent) / 100);
  };
  const quoteTotal = (q: (typeof c.quotations)[number]) => {
    const sub = q.items.reduce((s, i) => s + Number(i.qty) * Number(i.unitPrice), 0) - Number(q.discount);
    return sub * (1 + Number(q.vatPercent) / 100);
  };

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {name}
            <StatusBadge color={c.status.color}>{L(c.status)}</StatusBadge>
          </span>
        }
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span dir="auto">{other}</span>
            <span dir="ltr">{c.code}</span>
            <span className="inline-flex items-center gap-1">
              <UserRound className="size-3.5" /> {c.accountManager?.name ?? t("clients.unassigned")}
            </span>
          </span>
        }
        actions={
          canWrite && (
            <>
              <Button asChild variant="outline">
                <Link href={`/clients/${c.id}/edit`}>
                  <Pencil /> {t("common.edit")}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/requests/new?clientId=${c.id}`}>
                  <ClipboardPlus /> {t("requests.new")}
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/contracts/new?clientId=${c.id}`}>
                  <FilePlus2 /> {t("clients.newContract")}
                </Link>
              </Button>
              {can(user.role, "delete") && (
                <DeleteButton action={deleteClientAction.bind(null, c.id)} redirectTo="/clients" successKey="clients.deleted" />
              )}
            </>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("clients.totalContractValue")} value={formatMoneyCompact(totalValue, cur, locale, dg)} icon={FileSignature} />
        <KpiCard label={t("clients.amcPaid")} value={formatMoneyCompact(collected, cur, locale, dg)} icon={Banknote} tone="success" />
        <KpiCard label={t("clients.amcDue")} value={formatMoneyCompact(outstanding, cur, locale, dg)} icon={CircleDollarSign} tone={outstanding ? "danger" : "default"} />
        <KpiCard label={t("clients.openRequests")} value={openReq} icon={ClipboardList} />
      </div>

      <Tabs defaultValue={TABS.includes(tab as never) ? tab : "overview"} className="min-w-0 gap-4">
        <div className="overflow-x-auto">
          <TabsList>
            <TabsTrigger value="overview">{t("clients.tabOverview")}</TabsTrigger>
            <TabsTrigger value="contracts">
              {t("clients.tabContracts")} ({c.contracts.length})
            </TabsTrigger>
            <TabsTrigger value="requests">
              {t("clients.tabRequests")} ({c.requests.length})
            </TabsTrigger>
            <TabsTrigger value="quotations">
              {t("clients.tabQuotations")} ({c.quotations.length})
            </TabsTrigger>
            <TabsTrigger value="emails">{t("clients.tabEmails")}</TabsTrigger>
            <TabsTrigger value="files">
              {t("clients.tabFiles")} ({files.length})
            </TabsTrigger>
            <TabsTrigger value="timeline">{t("clients.tabTimeline")}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>{t("clients.basicInfo")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Info label={t("clients.industry")} value={c.industry ? L(c.industry) : "—"} />
              <Info label={t("clients.preferredLang")} value={t(`languages.${c.preferredLang}`)} />
              <Info label={t("clients.city")} value={c.city ?? "—"} icon={MapPin} />
              <Info label={t("clients.address")} value={c.address ?? "—"} />
              <Info label={t("clients.website")} value={c.website ?? "—"} icon={Globe} ltr />
              <Info label={t("clients.taxNumber")} value={c.taxNumber ?? "—"} ltr />
              {c.notes && <Info label={t("clients.notes")} value={<span className="whitespace-pre-wrap">{c.notes}</span>} />}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("clients.contacts")}</CardTitle>
            </CardHeader>
            <CardContent>
              {c.contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("clients.noContacts")}</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {c.contacts.map((p) => (
                    <div key={p.id} className="space-y-2 rounded-lg border p-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium" dir="auto">{p.name}</span>
                        {p.isPrimary && <Star className="size-3.5 fill-amber-400 text-amber-400" aria-label={t("clients.primary")} />}
                      </div>
                      {p.jobTitle && <p className="text-muted-foreground">{p.jobTitle}</p>}
                      <div className="flex flex-wrap gap-2">
                        {p.phone && (
                          <Button asChild size="xs" variant="outline">
                            <a href={`tel:${p.phone}`} dir="ltr">
                              <Phone /> {p.phone}
                            </a>
                          </Button>
                        )}
                        {p.whatsapp && (
                          <Button asChild size="xs" variant="outline">
                            <a href={`https://wa.me/${p.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" title={t("clients.callWhatsapp")}>
                              <MessageCircle /> WhatsApp
                            </a>
                          </Button>
                        )}
                        {p.email && (
                          <Button asChild size="xs" variant="outline">
                            <a href={`mailto:${p.email}`} dir="ltr">
                              <Mail /> {p.email}
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts">
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("contracts.number")}</TableHead>
                  <TableHead>{t("contracts.products")}</TableHead>
                  <TableHead>{t("contracts.contractDate")}</TableHead>
                  <TableHead>{t("contracts.status")}</TableHead>
                  <TableHead>{t("contracts.nextAmc")}</TableHead>
                  <TableHead className="text-end">{t("contracts.value")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.contracts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                      {t("common.noResults")}
                    </TableCell>
                  </TableRow>
                )}
                {c.contracts.map((k) => {
                  const next = k.amcLines.find((l) => l.status !== "PAID");
                  return (
                    <TableRow key={k.id}>
                      <TableCell>
                        <Link href={`/contracts/${k.id}`} className="font-medium hover:underline" dir="ltr">
                          {k.number}
                        </Link>
                      </TableCell>
                      <TableCell>{k.products.map((p) => L(p.product)).join("، ")}</TableCell>
                      <TableCell>{formatDate(k.contractDate, locale, dg)}</TableCell>
                      <TableCell>
                        <StatusBadge color={STATUS_COLOR[k.status]}>{t(`contractStatus.${k.status}`)}</StatusBadge>
                      </TableCell>
                      <TableCell>
                        {next ? (
                          <span className={next.dueDate < today ? "font-medium text-destructive" : ""}>
                            {formatDate(next.dueDate, locale, dg)} · {formatMoney(next.amount, k.currency, locale, dg)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="num text-end">{formatMoney(k.value, k.currency, locale, dg)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("common.details")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("amc.dueDate")}</TableHead>
                  <TableHead className="text-end">{t("common.total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.requests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                      {t("clients.noRequests")}
                    </TableCell>
                  </TableRow>
                )}
                {c.requests.map((r) => {
                  const overdue = r.dueDate && r.dueDate < today && !["CLOSED", "REJECTED", "DELIVERED"].includes(r.status);
                  return (
                    <TableRow key={r.id} className={overdue ? "bg-destructive/5" : ""}>
                      <TableCell dir="ltr" className="text-muted-foreground">
                        {r.number}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/requests/${r.id}`} className="hover:underline">
                          {r.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge color={STATUS_COLOR[r.status]}>{t(`requestStatus.${r.status}`)}</StatusBadge>
                      </TableCell>
                      <TableCell className={overdue ? "font-medium text-destructive" : ""}>{formatDate(r.dueDate, locale, dg)}</TableCell>
                      <TableCell className="num text-end">{formatMoney(reqTotal(r), r.currency, locale, dg)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="quotations">
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("common.details")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead className="text-end">{t("common.total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.quotations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-20 text-center text-muted-foreground">
                      {t("clients.noQuotations")}
                    </TableCell>
                  </TableRow>
                )}
                {c.quotations.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell dir="ltr">
                      <Link href={`/quotations/${q.id}`} className="font-medium hover:underline">
                        {q.number} v{q.version}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{q.title ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge color={STATUS_COLOR[q.status]}>{t(`quotationStatus.${q.status}`)}</StatusBadge>
                    </TableCell>
                    <TableCell>{formatDate(q.issueDate, locale, dg)}</TableCell>
                    <TableCell className="num text-end">{formatMoney(quoteTotal(q), q.currency, locale, dg)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="emails">
          <Card>
            <CardContent>
              {c.emails.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("clients.noEmails")}</p>
              ) : (
                <ul className="divide-y">
                  {c.emails.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium" dir="auto">
                          {e.subject}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span dir="ltr">{e.to.join(", ")}</span> · {formatDateTime(e.createdAt, locale, dg)} {e.sentBy ? `· ${e.sentBy.name}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {e.attachmentUrl && (
                          <a href={`/api/emails/${e.id}/attachment`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline" dir="ltr">
                            <Paperclip className="size-3" /> {e.attachmentName}
                          </a>
                        )}
                        <StatusBadge color={e.status === "SENT" ? "green" : "red"}>{t(`email.${e.status}`)}</StatusBadge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files">
          <Card>
            <CardContent>
              <AttachmentsPanel
                entityType="CLIENT"
                entityId={c.id}
                items={toAttachmentItems(files)}
                canWrite={canWrite}
                canDelete={can(user.role, "delete")}
                revalidate={`/clients/${c.id}`}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardContent>
              <Timeline items={c.activities} empty={t("clients.noTimeline")} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Info({
  label,
  value,
  icon: Icon,
  ltr,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  ltr?: boolean;
}) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        {Icon && <Icon className="size-3.5 text-muted-foreground" />}
        <span dir={ltr ? "ltr" : undefined}>{value}</span>
      </span>
    </div>
  );
}
