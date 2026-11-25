import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ClientsTable } from "@/components/clients/clients-table";
import { can, requireUser } from "@/server/auth-guard";
import { listClients } from "@/server/services/clients";
import { getAssignableUsers, getLookups } from "@/server/services/lookups";

export async function generateMetadata() {
  return { title: (await getTranslations("clients"))("title") };
}

export default async function ClientsPage() {
  const user = await requireUser();
  const [t, rows, statuses, industries, managers] = await Promise.all([
    getTranslations(),
    listClients(),
    getLookups("CLIENT_STATUS", true),
    getLookups("INDUSTRY", true),
    getAssignableUsers(),
  ]);
  const canWrite = can(user.role, "write");
  const newButton = canWrite && (
    <Button asChild>
      <Link href="/clients/new">
        <Plus /> {t("clients.new")}
      </Link>
    </Button>
  );
  return (
    <>
      <PageHeader title={t("clients.title")} actions={newButton} />
      {rows.length === 0 ? (
        <EmptyState icon={Building2} title={t("common.emptyTitle")} description={t("common.emptyDescription")} action={newButton} />
      ) : (
        <ClientsTable rows={rows} statuses={statuses} industries={industries} managers={managers} />
      )}
    </>
  );
}
