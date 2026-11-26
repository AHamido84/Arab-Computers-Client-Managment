import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { FolderKanban, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ProjectsTable } from "@/components/delivery/projects-table";
import { can, requirePagePermission } from "@/server/auth-guard";
import { awaitingSetup, listProjects } from "@/server/services/delivery";

export async function generateMetadata() {
  return { title: (await getTranslations("delivery"))("title") };
}

export default async function DeliveryPage() {
  const user = await requirePagePermission("read");
  const [t, locale, rows, pending] = await Promise.all([getTranslations(), getLocale(), listProjects(), awaitingSetup()]);
  const canManage = can(user.role, "manageDelivery");
  return (
    <>
      <PageHeader title={t("delivery.title")} />
      {canManage && pending.length > 0 && (
        <Card className="mb-6 border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="size-4 text-primary" /> {t("delivery.awaiting")}
            </CardTitle>
            <CardDescription>{t("delivery.awaitingHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {pending.map((p) => (
                <li key={`${p.kind}-${p.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="font-medium">{locale === "ar" ? p.client.nameAr : p.client.nameEn}</span> ·{" "}
                    <Link href={`/${p.kind === "quotation" ? "quotations" : "contracts"}/${p.id}`} className="hover:underline" dir="ltr">
                      {p.reference}
                    </Link>
                    {p.title && <span className="text-muted-foreground" dir="auto"> — {p.title}</span>}
                  </span>
                  <Button asChild size="sm">
                    <Link href={`/delivery/new?${p.kind}Id=${p.id}`}>{t("delivery.setUp")}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {rows.length === 0 ? <EmptyState icon={FolderKanban} title={t("delivery.empty")} /> : <ProjectsTable rows={rows} />}
    </>
  );
}
