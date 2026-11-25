import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { ClientForm } from "@/components/clients/client-form";
import { requirePagePermission } from "@/server/auth-guard";
import { getClientForEdit } from "@/server/services/clients";
import { getAssignableUsers, getLookups } from "@/server/services/lookups";

export default async function EditClientPage({ params }: PageProps<"/clients/[id]/edit">) {
  await requirePagePermission("write");
  const { id } = await params;
  const [t, c, statuses, industries, managers] = await Promise.all([
    getTranslations("clients"),
    getClientForEdit(id),
    getLookups("CLIENT_STATUS", true),
    getLookups("INDUSTRY"),
    getAssignableUsers(),
  ]);
  if (!c) notFound();
  const s = (v: string | null) => v ?? "";
  return (
    <>
      <PageHeader title={t("edit")} description={c.nameEn} />
      <ClientForm
        clientId={c.id}
        statuses={statuses}
        industries={industries}
        managers={managers}
        defaultValues={{
          nameAr: c.nameAr, nameEn: c.nameEn, statusId: c.statusId, industryId: s(c.industryId),
          preferredLang: c.preferredLang, address: s(c.address), city: s(c.city), website: s(c.website),
          taxNumber: s(c.taxNumber), notes: s(c.notes), accountManagerId: s(c.accountManagerId),
          contacts: c.contacts.map((p) => ({
            id: p.id, name: p.name, jobTitle: s(p.jobTitle), phone: s(p.phone), whatsapp: s(p.whatsapp), email: s(p.email), isPrimary: p.isPrimary,
          })),
        }}
      />
    </>
  );
}
