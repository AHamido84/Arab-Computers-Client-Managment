import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { ClientForm, emptyContact } from "@/components/clients/client-form";
import { requirePagePermission } from "@/server/auth-guard";
import { getAssignableUsers, getLookups } from "@/server/services/lookups";

export async function generateMetadata() {
  return { title: (await getTranslations("clients"))("new") };
}

export default async function NewClientPage() {
  const user = await requirePagePermission("write");
  const [t, statuses, industries, managers] = await Promise.all([
    getTranslations("clients"),
    getLookups("CLIENT_STATUS"),
    getLookups("INDUSTRY"),
    getAssignableUsers(),
  ]);
  const lead = statuses.find((s) => s.key === "LEAD") ?? statuses[0];
  return (
    <>
      <PageHeader title={t("new")} />
      <ClientForm
        statuses={statuses}
        industries={industries}
        managers={managers}
        defaultValues={{
          nameAr: "", nameEn: "", statusId: lead?.id ?? "", industryId: "", preferredLang: "ar",
          address: "", city: "", website: "", taxNumber: "", notes: "",
          accountManagerId: user.role === "ACCOUNT_MANAGER" ? user.id : "",
          contacts: [{ ...emptyContact, isPrimary: true }],
        }}
      />
    </>
  );
}
