import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { ContractForm } from "@/components/contracts/contract-form";
import { requirePagePermission } from "@/server/auth-guard";
import { getContract } from "@/server/services/contracts";
import { getClientOptions, getLookups } from "@/server/services/lookups";
import { toDateInput } from "@/lib/validation/common";

export default async function EditContractPage({ params }: PageProps<"/contracts/[id]/edit">) {
  await requirePagePermission("write");
  const { id } = await params;
  const [t, c, clients, products, terms] = await Promise.all([
    getTranslations("contracts"),
    getContract(id),
    getClientOptions(),
    getLookups("PRODUCT", true),
    getLookups("PAYMENT_TERM"),
  ]);
  if (!c) notFound();
  return (
    <>
      <PageHeader title={t("edit")} description={<span dir="ltr">{c.number}</span>} />
      <ContractForm
        contractId={c.id}
        clients={clients}
        products={products.filter((p) => p.active || c.products.some((cp) => cp.productId === p.id))}
        paymentTerms={terms}
        defaultValues={{
          clientId: c.clientId, title: c.title ?? "", productIds: c.products.map((p) => p.productId),
          contractDate: toDateInput(c.contractDate), startDate: toDateInput(c.startDate), endDate: toDateInput(c.endDate),
          value: String(c.value), currency: c.currency, paymentTerms: c.paymentTerms ?? "", status: c.status, notes: c.notes ?? "",
          amcEnabled: c.amcEnabled, amcPercent: String(c.amcPercent), amcIncreasePercent: String(c.amcIncreasePercent),
          amcMethod: c.amcMethod, amcStartDate: toDateInput(c.amcStartDate), amcYears: String(c.amcYears),
        }}
      />
    </>
  );
}
