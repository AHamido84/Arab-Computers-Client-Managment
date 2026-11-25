import type { Metadata } from "next";
import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Providers } from "@/components/providers";
import { dirOf, type AppLocale } from "@/i18n/config";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex-arabic",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: { default: `${t("name")} — ${t("product")}`, template: `%s · ${t("name")}` },
    description: t("product"),
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as AppLocale;
  const dir = dirOf(locale);
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning className={`${inter.variable} ${plexArabic.variable} h-full antialiased`}>
      <body className="min-h-full">
        <NextIntlClientProvider>
          <Providers dir={dir}>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
