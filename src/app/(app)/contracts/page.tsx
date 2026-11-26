import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FileSignature, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ContractsTable } from "@/components/contracts/contracts-table";
import { can, requirePagePermission } from "@/server/auth-guard";
import { listContracts } from "@/server/services/contracts";
import { getLookups } from "@/server/services/lookups";

export async function generateMetadata() {
  return { title: (await getTranslations("contracts"))("title") };
}

export default async function ContractsPage() {
  const user = await requirePagePermission("read");
  const [t, rows, products] = await Promise.all([getTranslations(), listContracts(), getLookups("PRODUCT", true)]);
  const newButton = can(user.role, "write") && (
    <Button asChild>
      <Link href="/contracts/new">
        <Plus /> {t("contracts.new")}
      </Link>
    </Button>
  );
  return (
    <>
      <PageHeader title={t("contracts.title")} actions={newButton} />
      {rows.length === 0 ? (
        <EmptyState icon={FileSignature} title={t("common.emptyTitle")} description={t("common.emptyDescription")} action={newButton} />
      ) : (
        <ContractsTable rows={rows} products={products} />
      )}
    </>
  );
}
