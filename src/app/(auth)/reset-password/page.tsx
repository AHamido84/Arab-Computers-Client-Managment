import { getTranslations } from "next-intl/server";
import { ResetForm } from "./reset-form";

export async function generateMetadata() {
  return { title: (await getTranslations("users"))("resetTitle") };
}

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = (await searchParams) as { token?: string };
  const t = await getTranslations("users");
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("resetTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("passwordRule")}</p>
      </div>
      <ResetForm token={token ?? ""} />
    </div>
  );
}
