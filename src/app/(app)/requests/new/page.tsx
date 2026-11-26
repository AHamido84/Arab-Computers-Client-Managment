import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { RequestForm } from "@/components/requests/request-form";
import { requirePagePermission } from "@/server/auth-guard";
import { getAssignableUsers, getClientOptions, getContractOptions, getLookups } from "@/server/services/lookups";
import { getSettings } from "@/server/services/settings";
import { todayUTC } from "@/lib/format";
import { toDateInput } from "@/lib/validation/common";

export async function generateMetadata() {
  return { title: (await getTranslations("requests"))("new") };
}

export default async function NewRequestPage({ searchParams }: PageProps<"/requests/new">) {
  const user = await requirePagePermission("write");
  const { clientId, contractId } = (await searchParams) as { clientId?: string; contractId?: string };
  const [t, clients, contracts, types, users, settings] = await Promise.all([
    getTranslations("requests"),
    getClientOptions(),
    getContractOptions(),
    getLookups("REQUEST_TYPE"),
    getAssignableUsers(),
    getSettings(),
  ]);
  const contract = contracts.find((c) => c.id === contractId);
  const cid = contract?.clientId ?? (clients.some((c) => c.id === clientId) ? clientId! : "");
  return (
    <>
      <PageHeader title={t("new")} />
      <RequestForm
        clients={clients}
        contracts={contracts}
        types={types}
        users={users}
        defaultValues={{
          clientId: cid, contractId: contract?.id ?? "", typeId: "", title: "", description: "", priority: "MEDIUM",
          assigneeId: user.role === "ACCOUNT_MANAGER" ? user.id : "", requestDate: toDateInput(todayUTC()), dueDate: "",
          estimatedHours: "", status: "NEW", currency: settings.defaultCurrency, discount: "0",
          vatPercent: String(settings.vatPercent), items: [],
        }}
      />
    </>
  );
}
