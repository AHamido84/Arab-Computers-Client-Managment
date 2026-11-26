import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { RequestForm } from "@/components/requests/request-form";
import { requirePagePermission } from "@/server/auth-guard";
import { getRequest } from "@/server/services/requests";
import { getAssignableUsers, getClientOptions, getContractOptions, getLookups } from "@/server/services/lookups";
import { toDateInput } from "@/lib/validation/common";

export default async function EditRequestPage({ params }: PageProps<"/requests/[id]/edit">) {
  await requirePagePermission("write");
  const { id } = await params;
  const [t, r, clients, contracts, types, users] = await Promise.all([
    getTranslations("requests"),
    getRequest(id),
    getClientOptions(),
    getContractOptions(),
    getLookups("REQUEST_TYPE", true),
    getAssignableUsers(),
  ]);
  if (!r) notFound();
  const s = (v: unknown) => (v == null ? "" : String(v));
  return (
    <>
      <PageHeader title={t("edit")} description={<span dir="ltr">{r.number}</span>} />
      <RequestForm
        requestId={r.id}
        clients={clients}
        contracts={contracts}
        types={types}
        users={users}
        defaultValues={{
          clientId: r.clientId, contractId: s(r.contractId), typeId: s(r.typeId), title: r.title, description: s(r.description),
          priority: r.priority, assigneeId: s(r.assigneeId), requestDate: toDateInput(r.requestDate), dueDate: toDateInput(r.dueDate),
          estimatedHours: s(r.estimatedHours), status: r.status, currency: r.currency, discount: s(r.discount), vatPercent: s(r.vatPercent),
          items: r.items.map((i) => ({ item: i.item, description: s(i.description), qty: s(i.qty), unitPrice: s(i.unitPrice) })),
        }}
      />
    </>
  );
}
