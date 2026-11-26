import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { QuotationForm } from "@/components/quotations/quotation-form";
import { requirePagePermission } from "@/server/auth-guard";
import { getClientOptions } from "@/server/services/lookups";
import { getQuotableRequests } from "@/server/services/requests";
import { getQuotation } from "@/server/services/quotations";
import { getDocumentTemplates } from "@/server/services/templates";
import { toDateInput } from "@/lib/validation/common";

export default async function EditQuotationPage({ params }: PageProps<"/quotations/[id]/edit">) {
  await requirePagePermission("write");
  const { id } = await params;
  const [t, q, clients, tpl] = await Promise.all([getTranslations("quotations"), getQuotation(id), getClientOptions(), getDocumentTemplates("QUOTATION")]);
  if (!q) notFound();
  if (q.status !== "DRAFT") redirect(`/quotations/${id}`);
  const requests = await getQuotableRequests(q.clientId);
  const s = (v: unknown) => (v == null ? "" : String(v));
  return (
    <>
      <PageHeader title={t("edit")} description={<span dir="ltr">{`${q.number} v${q.version}`}</span>} />
      <QuotationForm
        quotationId={q.id}
        clients={clients}
        initialRequests={requests}
        intros={{ ar: tpl.ar.body, en: tpl.en.body }}
        defaultValues={{
          clientId: q.clientId, title: s(q.title), lang: q.lang, issueDate: toDateInput(q.issueDate), validUntil: toDateInput(q.validUntil),
          currency: q.currency, discount: s(q.discount), vatPercent: s(q.vatPercent), introText: s(q.introText), terms: s(q.terms),
          items: q.items.map((i) => ({
            requestId: s(i.requestId), title: i.title, scope: s(i.scope), startDate: toDateInput(i.startDate), dueDate: toDateInput(i.dueDate),
            qty: s(i.qty), unitPrice: s(i.unitPrice),
          })),
        }}
      />
    </>
  );
}
