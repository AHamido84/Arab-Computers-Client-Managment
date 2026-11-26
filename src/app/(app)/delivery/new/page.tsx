import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DeliverySetup } from "@/components/delivery/delivery-setup";
import { requirePagePermission } from "@/server/auth-guard";
import { draftsFromContract, draftsFromQuotation, getDeliveryPeople } from "@/server/services/delivery";
import { db } from "@/lib/db";

export async function generateMetadata() {
  return { title: (await getTranslations("delivery"))("confirmTitle") };
}

/** /delivery/new?quotationId=… or ?contractId=… — the confirmation screen. */
export default async function NewDeliveryPage({ searchParams }: PageProps<"/delivery/new">) {
  await requirePagePermission("manageDelivery");
  const sp = (await searchParams) as { quotationId?: string; contractId?: string };
  const [t, locale, people] = await Promise.all([getTranslations(), getLocale(), getDeliveryPeople()]);
  const data = sp.quotationId ? await draftsFromQuotation(sp.quotationId) : sp.contractId ? await draftsFromContract(sp.contractId) : null;
  if (!data) notFound();

  // Already set up? Go to the existing project.
  const existing = await db.deliveryProject.findFirst({
    where: data.source === "QUOTATION" ? { quotationId: data.sourceId } : { contractId: data.sourceId },
    select: { id: true },
  });
  if (existing) redirect(`/delivery/${existing.id}`);

  const clientName = locale === "ar" ? data.client.nameAr : data.client.nameEn;
  const back = data.source === "QUOTATION" ? `/quotations/${data.sourceId}` : `/contracts/${data.sourceId}`;
  return (
    <>
      <PageHeader title={t("delivery.new")} description={<span>{clientName} · <span dir="ltr">{data.reference}</span></span>} />
      {!data.approved ? (
        <EmptyState
          title={t("delivery.notApproved")}
          action={
            <Button asChild variant="outline">
              <Link href={back}>{t("common.back")}</Link>
            </Button>
          }
        />
      ) : (
        <DeliverySetup
          source={data.source}
          sourceId={data.sourceId}
          clientId={data.client.id}
          reference={data.reference}
          defaultTitle={data.title}
          currency={data.currency}
          drafts={data.tasks}
          people={people.map((p) => ({ id: p.id, name: p.name, role: p.role }))}
        />
      )}
    </>
  );
}
