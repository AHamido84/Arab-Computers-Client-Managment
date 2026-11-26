import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { QuotationForm } from "@/components/quotations/quotation-form";
import { requirePagePermission } from "@/server/auth-guard";
import { getClientOptions } from "@/server/services/lookups";
import { getQuotableRequests } from "@/server/services/requests";
import { getSettings } from "@/server/services/settings";
import { getDocumentTemplates } from "@/server/services/templates";
import { DEFAULT_QUOTATION_TERMS } from "@/lib/templates/defaults";
import { todayUTC } from "@/lib/format";
import { toDateInput } from "@/lib/validation/common";

export async function generateMetadata() {
  return { title: (await getTranslations("quotations"))("new") };
}

export default async function NewQuotationPage({ searchParams }: PageProps<"/quotations/new">) {
  await requirePagePermission("write");
  const sp = (await searchParams) as { clientId?: string; requestIds?: string };
  const [t, clients, settings, tpl] = await Promise.all([getTranslations("quotations"), getClientOptions(), getSettings(), getDocumentTemplates("QUOTATION")]);
  const client = clients.find((c) => c.id === sp.clientId);
  const requests = client ? await getQuotableRequests(client.id) : [];
  const preselect = new Set((sp.requestIds ?? "").split(",").filter(Boolean));
  const lang = client?.preferredLang ?? "ar";
  const today = todayUTC();
  const items = requests
    .filter((r) => preselect.has(r.id))
    .flatMap((r) =>
      r.items.length
        ? r.items.map((i) => ({ requestId: r.id, title: i.item, scope: i.description ?? r.title, startDate: "", dueDate: r.dueDate, qty: String(i.qty), unitPrice: String(i.unitPrice) }))
        : [{ requestId: r.id, title: r.title, scope: r.description ?? "", startDate: "", dueDate: r.dueDate, qty: "1", unitPrice: "0" }],
    );
  const firstTitle = requests.find((r) => preselect.has(r.id))?.title ?? "";
  return (
    <>
      <PageHeader title={t("new")} />
      <QuotationForm
        clients={clients}
        initialRequests={requests}
        intros={{ ar: tpl.ar.body, en: tpl.en.body }}
        defaultValues={{
          clientId: client?.id ?? "",
          title: firstTitle,
          lang,
          issueDate: toDateInput(today),
          validUntil: toDateInput(new Date(today.getTime() + settings.quotationValidityDays * 86_400_000)),
          currency: settings.defaultCurrency,
          discount: "0",
          vatPercent: String(settings.vatPercent),
          introText: tpl[lang].body,
          terms: DEFAULT_QUOTATION_TERMS[lang],
          items: items.length ? items : [{ requestId: "", title: "", scope: "", startDate: "", dueDate: "", qty: "1", unitPrice: "0" }],
        }}
      />
    </>
  );
}
