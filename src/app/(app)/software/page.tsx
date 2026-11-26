import { getTranslations } from "next-intl/server";
import { AppWindow } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { SoftwareTable } from "@/components/software/software-table";
import { SoftwareDialog } from "@/components/software/software-dialog";
import { can, requirePagePermission } from "@/server/auth-guard";
import { listSoftware } from "@/server/services/software";

export async function generateMetadata() {
  return { title: (await getTranslations("software"))("title") };
}

export default async function SoftwarePage() {
  const user = await requirePagePermission("read");
  const [t, rows] = await Promise.all([getTranslations(), listSoftware()]);
  const canWrite = can(user.role, "write");
  const addButton = canWrite && <SoftwareDialog />;
  return (
    <>
      <PageHeader title={t("software.title")} description={t("software.subtitle")} actions={addButton} />
      {rows.length === 0 ? (
        <EmptyState icon={AppWindow} title={t("software.empty")} description={t("software.emptyHint")} action={addButton} />
      ) : (
        <SoftwareTable rows={rows} canWrite={canWrite} />
      )}
    </>
  );
}
