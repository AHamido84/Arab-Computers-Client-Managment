import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { CompanyForm } from "@/components/settings/company-form";
import { requirePagePermission } from "@/server/auth-guard";
import { getSettings } from "@/server/services/settings";

export async function generateMetadata() {
  return { title: (await getTranslations("settings"))("company") };
}

export default async function CompanySettingsPage() {
  await requirePagePermission("manageSettings");
  const [t, s] = await Promise.all([getTranslations("settings"), getSettings()]);
  const v = (x: unknown) => (x == null ? "" : String(x));
  return (
    <>
      <PageHeader title={t("company")} description={t("companyDesc")} />
      <CompanyForm
        hasCustomLogo={!!s.logoUrl}
        defaultValues={{
          companyNameAr: s.companyNameAr, companyNameEn: s.companyNameEn, addressAr: v(s.addressAr), addressEn: v(s.addressEn),
          phone: v(s.phone), email: v(s.email), website: v(s.website), taxNumber: v(s.taxNumber), commercialRegister: v(s.commercialRegister),
          letterheadFooterAr: v(s.letterheadFooterAr), letterheadFooterEn: v(s.letterheadFooterEn), defaultCurrency: s.defaultCurrency,
          vatPercent: v(s.vatPercent), defaultAmcPercent: v(s.defaultAmcPercent), defaultAmcYears: v(s.defaultAmcYears),
          quotationValidityDays: v(s.quotationValidityDays), arabicDigits: s.arabicDigits, contractNumberFormat: s.contractNumberFormat,
          requestNumberFormat: s.requestNumberFormat, quotationNumberFormat: s.quotationNumberFormat, clientCodeFormat: s.clientCodeFormat,
        }}
      />
    </>
  );
}
