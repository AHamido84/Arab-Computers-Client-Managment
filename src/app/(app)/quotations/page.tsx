import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { QuotationsTable } from "@/components/quotations/quotations-table";
import { can, requirePagePermission } from "@/server/auth-guard";
import { listQuotations } from "@/server/services/quotations";
import { getClientOptions } from "@/server/services/lookups";

export async function generateMetadata() {
  return { title: (await getTranslations("quotations"))("title") };
}

export default async function QuotationsPage() {
  const user = await requirePagePermission("read");
  const [t, rows, clients] = await Promise.all([getTranslations(), listQuotations(), getClientOptions()]);
  const newButton = can(user.role, "write") && (
    <Button asChild>
      <Link href="/quotations/new">
        <Plus /> {t("quotations.new")}
      </Link>
    </Button>
  );
  return (
    <>
      <PageHeader title={t("quotations.title")} actions={newButton} />
      {rows.length === 0 ? (
        <EmptyState icon={FileText} title={t("common.emptyTitle")} description={t("common.emptyDescription")} action={newButton} />
      ) : (
        <QuotationsTable rows={rows} clients={clients} />
      )}
    </>
  );
}
