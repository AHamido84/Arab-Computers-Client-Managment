import { getTranslations } from "next-intl/server";
import { ForgotForm } from "./forgot-form";

export async function generateMetadata() {
  return { title: (await getTranslations("users"))("forgotTitle") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("users");
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("forgotTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("forgotHint")}</p>
      </div>
      <ForgotForm />
    </div>
  );
}
