import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("signIn") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  const t = await getTranslations();
  return (
    <div className="flex flex-col gap-6">
      <Image src="/brand/logo.png" alt={t("app.name")} width={220} height={43} className="lg:hidden dark:rounded-md dark:bg-white dark:p-2" priority />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("auth.signInTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.signInSubtitle")}</p>
      </div>
      <LoginForm callbackUrl={callbackUrl} />
    </div>
  );
}
