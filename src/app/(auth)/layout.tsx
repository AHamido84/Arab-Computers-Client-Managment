import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col p-6 md:p-10">
        <div className="flex items-center justify-end gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-brand-navy lg:flex lg:flex-col lg:items-center lg:justify-center lg:gap-6 lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,168,208,0.35),transparent_55%),radial-gradient(circle_at_80%_90%,rgba(30,76,154,0.8),transparent_50%)]" />
        <div className="relative rounded-2xl bg-white/95 px-8 py-6 shadow-2xl">
          <Image src="/brand/logo.png" alt={t("name")} width={360} height={70} priority />
        </div>
        <p className="relative max-w-md text-center text-lg text-white/90">{t("product")}</p>
        <p className="relative text-sm text-white/60">{t("tagline")}</p>
      </div>
    </div>
  );
}
