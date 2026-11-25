import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { ContractForm } from "@/components/contracts/contract-form";
import { requirePagePermission } from "@/server/auth-guard";
import { getClientOptions, getLookups } from "@/server/services/lookups";
import { getSettings } from "@/server/services/settings";
import { todayUTC } from "@/lib/format";
import { toDateInput } from "@/lib/validation/common";

export async function generateMetadata() {
  return { title: (await getTranslations("contracts"))("new") };
}

export default async function NewContractPage({ searchParams }: PageProps<"/contracts/new">) {
  await requirePagePermission("write");
  const { clientId } = (await searchParams) as { clientId?: string };
  const [t, clients, products, terms, settings] = await Promise.all([
    getTranslations("contracts"),
    getClientOptions(),
    getLookups("PRODUCT"),
    getLookups("PAYMENT_TERM"),
    getSettings(),
  ]);
  const today = toDateInput(todayUTC());
  return (
    <>
      <PageHeader title={t("new")} />
      <ContractForm
        clients={clients}
        products={products}
        paymentTerms={terms}
        defaultValues={{
          clientId: clients.some((c) => c.id === clientId) ? clientId! : "",
          title: "", productIds: [], contractDate: today, startDate: today, endDate: "",
          value: "", currency: settings.defaultCurrency, paymentTerms: "", status: "DRAFT", notes: "",
          amcEnabled: true, amcPercent: String(settings.defaultAmcPercent), amcIncreasePercent: "10",
          amcMethod: "COMPOUND", amcStartDate: "", amcYears: String(settings.defaultAmcYears),
        }}
      />
    </>
  );
}
