import { getTranslations } from "next-intl/server";
import { Hammer } from "lucide-react";
import { PageHeader } from "./page-header";
import { EmptyState } from "./empty-state";

export async function ComingSoon({ navKey }: { navKey: string }) {
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t(`nav.${navKey}`)} />
      <EmptyState icon={Hammer} title={t(`nav.${navKey}`)} description={t("common.comingSoon")} />
    </>
  );
}
